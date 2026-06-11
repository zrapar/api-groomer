import { Global, Module } from '@nestjs/common';
import { UserRepository } from './user.repository';
import { BusinessRepository } from './business.repository';
import { AppointmentRepository } from './appointment.repository';
import { PetRepository } from './pet.repository';
import { ServiceRepository } from './service.repository';
import { ServiceDurationRuleRepository } from './service-duration-rule.repository';
import { StaffRepository } from './staff.repository';
import { RefreshTokenRepository } from './refresh-token.repository';

const REPOSITORIES = [
  UserRepository,
  BusinessRepository,
  AppointmentRepository,
  PetRepository,
  ServiceRepository,
  ServiceDurationRuleRepository,
  StaffRepository,
  RefreshTokenRepository,
];

@Global()
@Module({
  providers: REPOSITORIES,
  exports: REPOSITORIES,
})
export class RepositoriesModule {}
