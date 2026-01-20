export type AppointmentWindow = {
  id?: string;
  startTime: Date;
  endTime: Date;
  status?: string;
};

export function hasOverlap(
  appointments: AppointmentWindow[],
  startTime: Date,
  endTime: Date,
  excludeId?: string,
) {
  return appointments.some((appt) => {
    if (excludeId && appt.id === excludeId) {
      return false;
    }
    if (appt.status === "CANCELLED") {
      return false;
    }
    return startTime < appt.endTime && endTime > appt.startTime;
  });
}
