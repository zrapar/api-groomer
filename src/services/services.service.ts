import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BusinessRepository } from '../repositories/business.repository';
import { ServiceRepository } from '../repositories/service.repository';
import { AuthUser } from '../auth/types/auth-user';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Injectable()
export class ServicesService {
  constructor(
    private readonly businessRepo: BusinessRepository,
    private readonly serviceRepo: ServiceRepository,
  ) {}

  async listForOwner(owner: AuthUser, limit = 100, offset = 0) {
    const business = await this.getBusinessOrFail(owner.id);
    return this.serviceRepo.findByBusinessId(business.id, limit, offset);
  }

  async create(owner: AuthUser, payload: CreateServiceDto) {
    const business = await this.getBusinessOrFail(owner.id);
    return this.serviceRepo.create(business.id, {
      name: payload.name,
      description: payload.description,
      speciesSupported: payload.speciesSupported,
      locationsSupported: payload.locationsSupported,
      priceAmount:
        payload.priceAmount != null ? String(payload.priceAmount) : null,
      priceCurrency: payload.priceCurrency ?? 'EUR',
      isActive: payload.isActive,
    });
  }

  async update(owner: AuthUser, serviceId: string, payload: UpdateServiceDto) {
    const business = await this.getBusinessOrFail(owner.id);
    const service = await this.serviceRepo.findById(serviceId);
    if (!service) throw new NotFoundException('Service not found.');
    if (service.businessId !== business.id)
      throw new ForbiddenException('Service does not belong to this owner.');

    return this.serviceRepo.update(serviceId, {
      name: payload.name ?? service.name,
      description: payload.description ?? service.description,
      speciesSupported: payload.speciesSupported ?? service.speciesSupported,
      locationsSupported:
        payload.locationsSupported ?? service.locationsSupported,
      priceAmount:
        payload.priceAmount !== undefined
          ? String(payload.priceAmount)
          : service.priceAmount,
      priceCurrency: payload.priceCurrency ?? service.priceCurrency,
      isActive: payload.isActive ?? service.isActive,
    });
  }

  async remove(owner: AuthUser, serviceId: string) {
    const business = await this.getBusinessOrFail(owner.id);
    const service = await this.serviceRepo.findById(serviceId);
    if (!service) throw new NotFoundException('Service not found.');
    if (service.businessId !== business.id)
      throw new ForbiddenException('Service does not belong to this owner.');
    return this.serviceRepo.deactivate(serviceId);
  }

  async listPublicServices(businessId: string) {
    return this.serviceRepo.findActiveByBusinessId(businessId);
  }

  private async getBusinessOrFail(ownerId: string) {
    const business = await this.businessRepo.findByOwnerId(ownerId);
    if (!business)
      throw new NotFoundException('Business not found for this owner.');
    return business;
  }
}
