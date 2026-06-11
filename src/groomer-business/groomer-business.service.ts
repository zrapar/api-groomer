import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BusinessRepository } from '../repositories/business.repository';
import { AuthUser } from '../auth/types/auth-user';
import { CreateGroomerBusinessDto } from './dto/create-groomer-business.dto';
import { UpdateGroomerBusinessDto } from './dto/update-groomer-business.dto';

@Injectable()
export class GroomerBusinessService {
  constructor(private readonly businessRepo: BusinessRepository) {}

  async create(owner: AuthUser, payload: CreateGroomerBusinessDto) {
    if (payload.offersAtHome && !payload.maxDogsPerHomeVisit) {
      throw new BadRequestException(
        'maxDogsPerHomeVisit is required when offersAtHome is true.',
      );
    }

    const existing = await this.businessRepo.findByOwnerId(owner.id);
    if (existing)
      throw new BadRequestException('Business already exists for this owner.');

    return this.businessRepo.create(
      owner.id,
      {
        slug: payload.slug,
        name: payload.name,
        description: payload.description,
        logoUrl: payload.logoUrl,
        coverImageUrl: payload.coverImageUrl,
        plan: payload.plan ?? 'FREE',
        phone: payload.phone,
        email: payload.email,
        address: payload.address,
        latitude: payload.latitude ? String(payload.latitude) : null,
        longitude: payload.longitude ? String(payload.longitude) : null,
        offersInSalon: payload.offersInSalon,
        offersAtHome: payload.offersAtHome,
        maxDogsPerHomeVisit: payload.maxDogsPerHomeVisit,
        homeVisitSetupMinutes: payload.homeVisitSetupMinutes,
        homeVisitTeardownMinutes: payload.homeVisitTeardownMinutes,
        defaultTransportMinutes: payload.defaultTransportMinutes,
        minHoursBeforeCancelOrReschedule:
          payload.minHoursBeforeCancelOrReschedule,
      },
      payload.workingHours,
    );
  }

  async getMyBusiness(owner: AuthUser) {
    const business = await this.businessRepo.getWithWorkingHours(owner.id);
    if (!business) throw new NotFoundException('Business not found.');
    return business;
  }

  async updateMyBusiness(owner: AuthUser, payload: UpdateGroomerBusinessDto) {
    if (payload.offersAtHome && !payload.maxDogsPerHomeVisit) {
      throw new BadRequestException(
        'maxDogsPerHomeVisit is required when offersAtHome is true.',
      );
    }

    const business = await this.businessRepo.findByOwnerId(owner.id);
    if (!business) throw new NotFoundException('Business not found.');

    return this.businessRepo.update(
      business.id,
      {
        slug: payload.slug,
        name: payload.name,
        description: payload.description,
        logoUrl: payload.logoUrl,
        coverImageUrl: payload.coverImageUrl,
        plan: payload.plan,
        phone: payload.phone,
        email: payload.email,
        address: payload.address,
        latitude:
          payload.latitude !== undefined ? String(payload.latitude) : undefined,
        longitude:
          payload.longitude !== undefined
            ? String(payload.longitude)
            : undefined,
        offersInSalon: payload.offersInSalon,
        offersAtHome: payload.offersAtHome,
        maxDogsPerHomeVisit: payload.maxDogsPerHomeVisit,
        homeVisitSetupMinutes: payload.homeVisitSetupMinutes,
        homeVisitTeardownMinutes: payload.homeVisitTeardownMinutes,
        defaultTransportMinutes: payload.defaultTransportMinutes,
        minHoursBeforeCancelOrReschedule:
          payload.minHoursBeforeCancelOrReschedule,
      },
      payload.workingHours,
    );
  }
}
