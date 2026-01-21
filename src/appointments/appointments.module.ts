import { Module } from "@nestjs/common";
import { AppointmentsController } from "./appointments.controller";
import { AppointmentsService } from "./appointments.service";
import { NotificationsModule } from "../notifications/notifications.module";
import { GoogleCalendarModule } from "../google-calendar/google-calendar.module";

@Module({
  imports: [NotificationsModule, GoogleCalendarModule],
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
})
export class AppointmentsModule {}
