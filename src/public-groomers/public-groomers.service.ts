import { Injectable, NotFoundException } from '@nestjs/common';
import { BusinessRepository } from '../repositories/business.repository';
import { ServiceRepository } from '../repositories/service.repository';
import { StaffRepository } from '../repositories/staff.repository';
import { UserRepository } from '../repositories/user.repository';

@Injectable()
export class PublicGroomersService {
  constructor(
    private readonly businessRepo: BusinessRepository,
    private readonly serviceRepo: ServiceRepository,
    private readonly staffRepo: StaffRepository,
    private readonly userRepo: UserRepository,
  ) {}

  async listBusinesses(limit = 100, offset = 0) {
    const businesses = await this.businessRepo.findAll(limit, offset);
    return { businesses };
  }

  async getBySlug(slug: string) {
    // findBySlug only returns PUBLIC_BUSINESS_COLUMNS — no Google tokens
    const business = await this.businessRepo.findBySlug(slug);
    if (!business) throw new NotFoundException('Business not found.');

    const services = await this.serviceRepo.findActiveByBusinessId(business.id);
    return { business, services };
  }

  async getBusiness(businessId: string) {
    const business = await this.businessRepo.findById(businessId);
    if (!business) throw new NotFoundException('Business not found.');

    return {
      business: {
        id: business.id,
        name: business.name,
        description: business.description,
        logoUrl: business.logoUrl,
        coverImageUrl: business.coverImageUrl,
        address: business.address,
        offersInSalon: business.offersInSalon,
        offersAtHome: business.offersAtHome,
        maxDogsPerHomeVisit: business.maxDogsPerHomeVisit,
        minHoursBeforeCancelOrReschedule:
          business.minHoursBeforeCancelOrReschedule,
      },
    };
  }

  async getStaff(businessId: string) {
    const business = await this.businessRepo.findById(businessId);
    if (!business) throw new NotFoundException('Business not found.');

    const activeStaff = await this.staffRepo.findActiveByBusinessId(businessId);
    const owner = await this.userRepo.findById(business.ownerUserId);

    const staff = activeStaff.map((s) => ({ ...s, isOwner: false }));
    const ownerEntry = owner
      ? {
          id: owner.id,
          displayName: business.name,
          email: owner.email,
          isOwner: true,
        }
      : null;

    return { businessId, staff: ownerEntry ? [ownerEntry, ...staff] : staff };
  }
}
