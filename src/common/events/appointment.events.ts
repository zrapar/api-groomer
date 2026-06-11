export class AppointmentCreatedEvent {
  constructor(
    public readonly appointmentId: string,
    public readonly userEmail: string,
    public readonly startTime: Date,
  ) {}
}

export class AppointmentStatusChangedEvent {
  constructor(
    public readonly appointmentId: string,
    public readonly userEmail: string,
    public readonly status: string,
  ) {}
}

export class AppointmentCancelledEvent {
  constructor(
    public readonly appointmentId: string,
    public readonly userEmail: string,
  ) {}
}

export const APPOINTMENT_EVENTS = {
  CREATED: 'appointment.created',
  STATUS_CHANGED: 'appointment.status_changed',
  CANCELLED: 'appointment.cancelled',
} as const;
