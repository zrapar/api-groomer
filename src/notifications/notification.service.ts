import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { createTransport } from 'nodemailer';
import {
  APPOINTMENT_EVENTS,
  AppointmentCancelledEvent,
  AppointmentCreatedEvent,
  AppointmentStatusChangedEvent,
} from '../common/events/appointment.events';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  private readonly transporter = createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  @OnEvent(APPOINTMENT_EVENTS.CREATED)
  async onAppointmentCreated(event: AppointmentCreatedEvent) {
    await this.sendEmail(
      event.userEmail,
      `Cita creada para el ${event.startTime.toISOString()}.`,
    );
  }

  @OnEvent(APPOINTMENT_EVENTS.STATUS_CHANGED)
  async onStatusChanged(event: AppointmentStatusChangedEvent) {
    await this.sendEmail(
      event.userEmail,
      `Cita ${event.appointmentId} estado cambiado a ${event.status}.`,
    );
  }

  @OnEvent(APPOINTMENT_EVENTS.CANCELLED)
  async onAppointmentCancelled(event: AppointmentCancelledEvent) {
    await this.sendEmail(
      event.userEmail,
      `Cita ${event.appointmentId} cancelada.`,
    );
  }

  async sendEmail(to: string, message: string) {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
      this.logger.warn(
        `Email skipped (SMTP not configured) → ${to}: ${message}`,
      );
      return;
    }
    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
        to,
        subject: message,
        text: message,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send email to ${to}: ${(error as Error).message}`,
      );
    }
  }
}
