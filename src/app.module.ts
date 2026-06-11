import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { RepositoriesModule } from './repositories/repositories.module';
import { HealthModule } from './health/health.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { CommonModule } from './common/common.module';
import { SeedModule } from './seed/seed.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { DbModule } from './db/db.module';
import { GroomerBusinessModule } from './groomer-business/groomer-business.module';
import { PetsModule } from './pets/pets.module';
import { ServicesModule } from './services/services.module';
import { ServiceDurationRulesModule } from './service-duration-rules/service-duration-rules.module';
import { AvailabilityModule } from './availability/availability.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PublicGroomersModule } from './public-groomers/public-groomers.module';
import { GoogleCalendarModule } from './google-calendar/google-calendar.module';
import { StaffModule } from './staff/staff.module';
import { AdminModule } from './admin/admin.module';
import { LoggerMiddleware } from './logger.middleware';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    DbModule,
    EventEmitterModule.forRoot({ wildcard: false }),
    CommonModule,
    SeedModule,
    RepositoriesModule,
    HealthModule,
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
    StaffModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
