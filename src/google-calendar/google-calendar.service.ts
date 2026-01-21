import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { google } from "googleapis";
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { DRIZZLE_DB } from "../db/db.module";
import * as schema from "../db/schema";

type OAuthState = {
  sub: string;
  businessId: string;
};

@Injectable()
export class GoogleCalendarService {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly jwtService: JwtService,
  ) {}

  async getAuthUrl(ownerId: string) {
    const business = await this.getBusinessForOwner(ownerId);
    const client = this.getOAuthClient();
    const state = this.jwtService.sign(
      { sub: ownerId, businessId: business.id } satisfies OAuthState,
      {
        secret: this.getStateSecret(),
        expiresIn: "10m",
      },
    );

    return client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: [
        "https://www.googleapis.com/auth/calendar",
        "https://www.googleapis.com/auth/userinfo.email",
      ],
      state,
    });
  }

  async handleCallback(code: string, state: string) {
    const payload = this.verifyState(state);
    const business = await this.getBusinessById(payload.businessId);
    const client = this.getOAuthClient();
    const { tokens } = await client.getToken(code);

    if (!tokens.refresh_token && !business.googleRefreshToken) {
      throw new BadRequestException("Missing refresh token from Google.");
    }

    client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: "v2", auth: client });
    const profile = await oauth2.userinfo.get();

    await this.db
      .update(schema.groomerBusinesses)
      .set({
        googleRefreshToken:
          tokens.refresh_token ?? business.googleRefreshToken ?? null,
        googleAccessToken: tokens.access_token ?? null,
        googleTokenExpiry: tokens.expiry_date
          ? new Date(tokens.expiry_date)
          : null,
        googleCalendarId: business.googleCalendarId ?? "primary",
        googleAccountEmail: profile.data.email ?? null,
        updatedAt: new Date(),
      })
      .where(eq(schema.groomerBusinesses.id, business.id));

    return business;
  }

  async getStatus(ownerId: string) {
    const business = await this.getBusinessForOwner(ownerId);
    return {
      connected: Boolean(business.googleRefreshToken),
      calendarId: business.googleCalendarId ?? "primary",
      accountEmail: business.googleAccountEmail ?? null,
    };
  }

  async disconnect(ownerId: string) {
    const business = await this.getBusinessForOwner(ownerId);
    await this.db
      .update(schema.groomerBusinesses)
      .set({
        googleRefreshToken: null,
        googleAccessToken: null,
        googleTokenExpiry: null,
        googleCalendarId: null,
        googleAccountEmail: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.groomerBusinesses.id, business.id));
  }

  async syncAppointment(appointmentId: string) {
    const appointment = await this.getAppointmentDetails(appointmentId);
    if (!appointment) {
      throw new NotFoundException("Appointment not found.");
    }
    const business = appointment.business;
    if (!business.googleRefreshToken) {
      return;
    }

    const calendarId = business.googleCalendarId ?? "primary";
    const client = await this.getAuthorizedClient(business);
    const calendar = google.calendar({ version: "v3", auth: client });

    if (
      appointment.status === "CANCELLED" ||
      appointment.status === "NO_SHOW"
    ) {
      if (appointment.googleEventId) {
        try {
          await calendar.events.delete({
            calendarId,
            eventId: appointment.googleEventId,
          });
        } catch (error) {
          console.warn("Google calendar delete failed", error);
        }
      }
      return;
    }

    const description = this.buildDescription(appointment);
    const event = {
      summary: `Cita ${appointment.locationType === "AT_HOME" ? "Domicilio" : "Salon"}`,
      description,
      location:
        appointment.locationType === "AT_HOME"
          ? appointment.homeAddress ?? business.address
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
        await this.db
          .update(schema.appointments)
          .set({ googleEventId: created.data.id })
          .where(eq(schema.appointments.id, appointment.id));
      }
    }
  }

  private getOAuthClient() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    if (!clientId || !clientSecret || !redirectUri) {
      throw new BadRequestException("Google OAuth is not configured.");
    }
    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }

  private getStateSecret() {
    return process.env.GOOGLE_OAUTH_STATE_SECRET || "change_me_state";
  }

  private verifyState(state: string) {
    return this.jwtService.verify<OAuthState>(state, {
      secret: this.getStateSecret(),
    });
  }

  private async getAuthorizedClient(
    business: typeof schema.groomerBusinesses.$inferSelect,
  ) {
    const client = this.getOAuthClient();
    client.setCredentials({
      refresh_token: business.googleRefreshToken ?? undefined,
      access_token: business.googleAccessToken ?? undefined,
      expiry_date: business.googleTokenExpiry?.getTime(),
    });

    client.on("tokens", (tokens) => {
      void this.db
        .update(schema.groomerBusinesses)
        .set({
          googleAccessToken: tokens.access_token ?? business.googleAccessToken,
          googleTokenExpiry: tokens.expiry_date
            ? new Date(tokens.expiry_date)
            : business.googleTokenExpiry,
          googleRefreshToken:
            tokens.refresh_token ?? business.googleRefreshToken,
          updatedAt: new Date(),
        })
        .where(eq(schema.groomerBusinesses.id, business.id));
    });

    await client.getAccessToken();
    return client;
  }

  private async getBusinessForOwner(ownerId: string) {
    const [business] = await this.db
      .select()
      .from(schema.groomerBusinesses)
      .where(eq(schema.groomerBusinesses.ownerUserId, ownerId));

    if (!business) {
      throw new NotFoundException("Business not found for this owner.");
    }
    return business;
  }

  private async getBusinessById(businessId: string) {
    const [business] = await this.db
      .select()
      .from(schema.groomerBusinesses)
      .where(eq(schema.groomerBusinesses.id, businessId));

    if (!business) {
      throw new NotFoundException("Business not found.");
    }
    return business;
  }

  private async getAppointmentDetails(appointmentId: string) {
    const rows = await this.db
      .select({
        appointment: schema.appointments,
        appointmentPet: schema.appointmentPets,
        pet: schema.pets,
        service: schema.services,
        client: schema.users,
        business: schema.groomerBusinesses,
      })
      .from(schema.appointments)
      .leftJoin(
        schema.appointmentPets,
        eq(schema.appointmentPets.appointmentId, schema.appointments.id),
      )
      .leftJoin(schema.pets, eq(schema.pets.id, schema.appointmentPets.petId))
      .leftJoin(
        schema.services,
        eq(schema.services.id, schema.appointmentPets.serviceId),
      )
      .leftJoin(schema.users, eq(schema.users.id, schema.appointments.clientId))
      .leftJoin(
        schema.groomerBusinesses,
        eq(schema.groomerBusinesses.id, schema.appointments.businessId),
      )
      .where(eq(schema.appointments.id, appointmentId));

    if (rows.length === 0) {
      return null;
    }

    const base = rows[0];
    if (!base.business) {
      throw new NotFoundException("Business not found.");
    }

    return {
      ...base.appointment,
      client: base.client,
      business: base.business!,
      items: rows
        .filter((row) => row.appointmentPet)
        .map((row) => ({
          pet: row.pet,
          service: row.service,
          appointmentPet: row.appointmentPet,
        })),
    };
  }

  private buildDescription(appointment: {
    client: typeof schema.users.$inferSelect | null;
    items: Array<{
      pet: typeof schema.pets.$inferSelect | null;
      service: typeof schema.services.$inferSelect | null;
    }>;
    status: string;
  }) {
    const lines: string[] = [];
    if (appointment.client?.email) {
      lines.push(`Cliente: ${appointment.client.email}`);
    }
    lines.push(`Estado: ${appointment.status}`);
    for (const item of appointment.items) {
      if (!item.pet || !item.service) {
        continue;
      }
      lines.push(
        `Mascota: ${item.pet.name} (${item.pet.species}) - Servicio: ${item.service.name}`,
      );
    }
    return lines.join("\n");
  }
}
