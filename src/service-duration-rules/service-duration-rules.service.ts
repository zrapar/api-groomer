import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BusinessRepository } from '../repositories/business.repository';
import { ServiceRepository } from '../repositories/service.repository';
import { ServiceDurationRuleRepository } from '../repositories/service-duration-rule.repository';
import { AuthUser } from '../auth/types/auth-user';
import {
  CreateServiceDurationRuleDto,
  UpdateServiceDurationRuleDto,
} from './dto/service-duration-rule.dto';

@Injectable()
export class ServiceDurationRulesService {
  constructor(
    private readonly businessRepo: BusinessRepository,
    private readonly serviceRepo: ServiceRepository,
    private readonly ruleRepo: ServiceDurationRuleRepository,
  ) {}

  async create(
    owner: AuthUser,
    serviceId: string,
    payload: CreateServiceDurationRuleDto,
  ) {
    await this.getServiceForOwner(owner.id, serviceId);

    if (!payload.size && !payload.breed && !payload.isDefaultForSpecies) {
      throw new BadRequestException(
        'Provide size, breed, or set isDefaultForSpecies for a rule.',
      );
    }

    return this.ruleRepo.create(serviceId, {
      species: payload.species,
      size: payload.size,
      breed: payload.breed,
      baseDurationMinutes: payload.baseDurationMinutes,
      isDefaultForSpecies: payload.isDefaultForSpecies ?? false,
    });
  }

  async list(owner: AuthUser, serviceId: string) {
    await this.getServiceForOwner(owner.id, serviceId);
    return this.ruleRepo.findByServiceId(serviceId);
  }

  async update(
    owner: AuthUser,
    ruleId: string,
    payload: UpdateServiceDurationRuleDto,
  ) {
    const rule = await this.ruleRepo.findById(ruleId);
    if (!rule) throw new NotFoundException('Duration rule not found.');
    await this.getServiceForOwner(owner.id, rule.serviceId);

    return this.ruleRepo.update(ruleId, {
      species: payload.species ?? rule.species,
      size: payload.size ?? rule.size,
      breed: payload.breed ?? rule.breed,
      baseDurationMinutes:
        payload.baseDurationMinutes ?? rule.baseDurationMinutes,
      isDefaultForSpecies:
        payload.isDefaultForSpecies ?? rule.isDefaultForSpecies,
    });
  }

  async remove(owner: AuthUser, ruleId: string) {
    const rule = await this.ruleRepo.findById(ruleId);
    if (!rule) throw new NotFoundException('Duration rule not found.');
    await this.getServiceForOwner(owner.id, rule.serviceId);
    await this.ruleRepo.delete(ruleId);
    return { deleted: true };
  }

  private async getServiceForOwner(ownerId: string, serviceId: string) {
    const business = await this.businessRepo.findByOwnerId(ownerId);
    if (!business)
      throw new NotFoundException('Business not found for this owner.');

    const service = await this.serviceRepo.findById(serviceId);
    if (!service) throw new NotFoundException('Service not found.');
    if (service.businessId !== business.id)
      throw new ForbiddenException('Service does not belong to this owner.');

    return service;
  }
}
