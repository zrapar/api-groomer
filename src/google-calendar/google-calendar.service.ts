import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { google } from 'googleapis';
import { BusinessRepository } from '../repositories/business.repository';
import { AppointmentRepository } from '../repositories/appointment.repository';
import { EncryptionService } from '../common/encryption.service';
import * as schema from '../db/schema';

type OAuthState = { sub: string; businessId: string };

@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);

  constructor(
    private readonly businessRepo: BusinessRepository,
    private readonly appointmentRepo: AppointmentRepository,
    private readonly jwtService: JwtService,
    private readonly encryption: EncryptionService,
  ) {}

  async getAuthUrl(ownerId: string) {
    const business = await this.getBusinessOrFail(ownerId);
    const client = this.getOAuthClient();
    const state = this.jwtService.sign(
      { sub: ownerId, businessId: business.id } satisfies OAuthState,
      { secret: this.getStateSecret(), expiresIn: '10m' },
    );
    return client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/userinfo.email',
      ],
      state,
    });
  }

  async handleCallback(code: string, state: string) {
    const payload = this.verifyState(state);
    const business = await this.businessRepo.findById(payload.businessId);
    if (!business) throw new NotFoundException('Business not found.');

    const client = this.getOAuthClient();
    const { tokens } = await client.getToken(code);

    if (!tokens.refresh_token && !business.googleRefreshToken) {
      throw new BadRequestException('Missing refresh token from Google.');
    }

    client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const profile = await oauth2.userinfo.get();

    const refreshToken =
      tokens.refresh_token ?? business.googleRefreshToken ?? null;
    await this.businessRepo.updateGoogleTokens(business.id, {
      refreshToken: refreshToken ? this.encryption.encrypt(refreshToken) : null,
      accessToken: tokens.access_token
        ? this.encryption.encrypt(tokens.access_token)
        : null,
      tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      calendarId: business.googleCalendarId ?? 'primary',
      accountEmail: profile.data.email ?? null,
    });

    return business;
  }

  async getStatus(ownerId: string) {
    const business = await this.getBusinessOrFail(ownerId);
    return {
      connected: Boolean(business.googleRefreshToken),
      calendarId: business.googleCalendarId ?? 'primary',
      accountEmail: business.googleAccountEmail ?? null,
    };
  }

  async disconnect(ownerId: string) {
    const business = await this.getBusinessOrFail(ownerId);
    await this.businessRepo.clearGoogleTokens(business.id);
  }

  async syncAppointment(appointmentId: string, attempt = 1): Promise<void> {
    try {
      await this.syncAppointmentInternal(appointmentId);
    } catch (error) {
      if (attempt < 3) {
        const delay = attempt * 2000;
        this.logger.warn(
          `Google Calendar sync failed (attempt ${attempt}/3), retrying in ${delay}ms: ${(error as Error).message}`,
        );
        await new Promise((r) => setTimeout(r, delay));
        return this.syncAppointment(appointmentId, attempt + 1);
      }
      this.logger.error(
        `Google Calendar sync failed after 3 attempts for appointment ${appointmentId}: ${(error as Error).message}`,
      );
    }
  }

  private async syncAppointmentInternal(appointmentId: string) {
    const appointment =
      await this.appointmentRepo.findWithDetailsById(appointmentId);
    if (!appointment) throw new NotFoundException('Appointment not found.');
    if (!appointment.business?.id) return;

    const business = await this.businessRepo.findById(appointment.business.id);
    if (!business?.googleRefreshToken) return;

    const calendarId = business.googleCalendarId ?? 'primary';
    const client = await this.getAuthorizedClient(business);
    const calendar = google.calendar({ version: 'v3', auth: client });

    if (
      appointment.status === 'CANCELLED' ||
      appointment.status === 'NO_SHOW'
    ) {
      if (appointment.googleEventId) {
        try {
          await calendar.events.delete({
            calendarId,
            eventId: appointment.googleEventId,
          });
        } catch (error) {
          this.logger.warn(
            `Google calendar delete failed: ${(error as Error).message}`,
          );
        }
      }
      return;
    }

    const description = this.buildDescription(appointment);
    const event = {
      summary: `Cita ${appointment.locationType === 'AT_HOME' ? 'Domicilio' : 'Salon'}`,
      description,
      location:
        appointment.locationType === 'AT_HOME'
          ? (appointment.homeAddress ?? business.address)
          : business.address,
      start: { dateTime: appointment.startTime.toISOString() },
      end: { dateTime: appointment.endTime.toISOString() },
    };

    if (appointment.googleEventId) {
      await calendar.events.update({
        calendarId,
        eventId: appointment.googleEventId,
        requestBody: event,
      });
    } else {
      const created = await calendar.events.insert({
        calendarId,
        requestBody: event,
      });
      if (created.data.id) {
        await this.appointmentRepo.update(appointment.id, {
          googleEventId: created.data.id,
        });
      }
    }
  }

  private async getAuthorizedClient(
    business: typeof schema.groomerBusinesses.$inferSelect,
  ) {
    const client = this.getOAuthClient();
    client.setCredentials({
      refresh_token: business.googleRefreshToken
        ? this.encryption.decrypt(business.googleRefreshToken)
        : undefined,
      access_token: business.googleAccessToken
        ? this.encryption.decrypt(business.googleAccessToken)
        : undefined,
      expiry_date: business.googleTokenExpiry?.getTime(),
    });

    client.on('tokens', (tokens) => {
      this.businessRepo
        .updateGoogleTokens(business.id, {
          accessToken: tokens.access_token ?? business.googleAccessToken,
          tokenExpiry: tokens.expiry_date
            ? new Date(tokens.expiry_date)
            : undefined,
          refreshToken: tokens.refresh_token ?? business.googleRefreshToken,
        })
        .catch((err) =>
          this.logger.error(
            `Failed to persist Google tokens: ${(err as Error).message}`,
          ),
        );
    });

    await client.getAccessToken();
    return client;
  }

  private getOAuthClient() {
    const {
      GOOGLE_CLIENT_ID: clientId,
      GOOGLE_CLIENT_SECRET: clientSecret,
      GOOGLE_REDIRECT_URI: redirectUri,
    } = process.env;
    if (!clientId || !clientSecret || !redirectUri) {
      throw new BadRequestException('Google OAuth is not configured.');
    }
    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }

  private getStateSecret() {
    return process.env.GOOGLE_OAUTH_STATE_SECRET || 'change_me_state';
  }

  private verifyState(state: string) {
    return this.jwtService.verify<OAuthState>(state, {
      secret: this.getStateSecret(),
    });
  }

  private async getBusinessOrFail(ownerId: string) {
    const business = await this.businessRepo.findByOwnerId(ownerId);
    if (!business)
      throw new NotFoundException('Business not found for this owner.');
    return business;
  }

  private buildDescription(appointment: {
    client: { email: string } | null;
    items: Array<{
      pet: { name: string; species: string } | null;
      service: { name: string } | null;
    }>;
    status: string;
  }) {
    const lines: string[] = [];
    if (appointment.client?.email)
      lines.push(`Cliente: ${appointment.client.email}`);
    lines.push(`Estado: ${appointment.status}`);
    for (const item of appointment.items) {
      if (item.pet && item.service) {
        lines.push(
          `Mascota: ${item.pet.name} (${item.pet.species}) - Servicio: ${item.service.name}`,
        );
      }
    }
    return lines.join('\n');
  }
}
