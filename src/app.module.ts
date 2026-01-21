import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { DbModule } from "./db/db.module";
import { GroomerBusinessModule } from "./groomer-business/groomer-business.module";
import { PetsModule } from "./pets/pets.module";
import { ServicesModule } from "./services/services.module";
import { ServiceDurationRulesModule } from "./service-duration-rules/service-duration-rules.module";
import { AvailabilityModule } from "./availability/availability.module";
import { AppointmentsModule } from "./appointments/appointments.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { PublicGroomersModule } from "./public-groomers/public-groomers.module";
import { GoogleCalendarModule } from "./google-calendar/google-calendar.module";

@Module({
  imports: [
    DbModule,
    AuthModule,
    GroomerBusinessModule,
    PetsModule,
    ServicesModule,
    ServiceDurationRulesModule,
    AvailabilityModule,
    AppointmentsModule,
    NotificationsModule,
    PublicGroomersModule,
    GoogleCalendarModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
