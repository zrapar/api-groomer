import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BusinessRepository } from '../repositories/business.repository';
import { AppointmentRepository } from '../repositories/appointment.repository';
import { PetRepository } from '../repositories/pet.repository';
import { ServiceRepository } from '../repositories/service.repository';
import { ServiceDurationRuleRepository } from '../repositories/service-duration-rule.repository';
import { StaffRepository } from '../repositories/staff.repository';
import { AuthUser } from '../auth/types/auth-user';
import { UserRole } from '../auth/dto/user-role.enum';
import { AvailabilityRequestDto } from './dto/availability.dto';
import { PetSize, PetSpecies } from '../pets/dto/pet.enums';
import { ServiceLocation } from '../services/dto/service.enums';
import { hasOverlap } from '../shared/overlap';
import { resolveDurationMinutes } from '../shared/duration';

const SLOT_STEP_MINUTES = 15;

@Injectable()
export class AvailabilityService {
  constructor(
    private readonly businessRepo: BusinessRepository,
    private readonly appointmentRepo: AppointmentRepository,
    private readonly petRepo: PetRepository,
    private readonly serviceRepo: ServiceRepository,
    private readonly ruleRepo: ServiceDurationRuleRepository,
    private readonly staffRepo: StaffRepository,
  ) {}

  async getAvailability(
    user: AuthUser,
    businessId: string,
    payload: AvailabilityRequestDto,
  ) {
    const business = await this.businessRepo.findById(businessId);
    if (!business) throw new NotFoundException('Business not found.');

    this.validateLocationSupported(business, payload.locationType);

    const petIds = payload.items.map((i) => i.petId);
    const serviceIds = [...new Set(payload.items.map((i) => i.serviceId))];

    const [pets, services] = await Promise.all([
      this.petRepo.findByIds(petIds),
      this.serviceRepo.findByIds(serviceIds),
    ]);

    if (pets.length !== petIds.length)
      throw new NotFoundException('One or more pets were not found.');
    if (services.length !== serviceIds.length)
      throw new NotFoundException('One or more services were not found.');

    if (user.role === UserRole.CLIENT) {
      const invalidPet = pets.find((p) => p.ownerUserId !== user.id);
      if (invalidPet)
        throw new BadRequestException(
          'Pets must belong to the current client.',
        );
    }

    for (const service of services) {
      if (service.businessId !== business.id)
        throw new BadRequestException(
          'Service does not belong to this business.',
        );
      if (!service.isActive)
        throw new BadRequestException('Service is not active.');
      if (!service.locationsSupported.includes(payload.locationType)) {
        throw new BadRequestException(
          `Service ${service.name} is not offered for ${payload.locationType}.`,
        );
      }
    }

    const totalDurationMinutes = await this.calculateTotalDuration(
      business,
      payload.items,
      pets,
      services,
      payload.locationType,
    );
    const groomerId = await this.resolveGroomerId(
      business.id,
      business.ownerUserId,
      payload.groomerId,
    );
    const slots = await this.buildAvailability(
      business,
      payload.date,
      totalDurationMinutes,
      groomerId,
    );

    return {
      date: payload.date,
      locationType: payload.locationType,
      durationMinutes: totalDurationMinutes,
      slots,
    };
  }

  private async calculateTotalDuration(
    business: {
      homeVisitSetupMinutes: number;
      homeVisitTeardownMinutes: number;
      defaultTransportMinutes: number;
      maxDogsPerHomeVisit: number | null;
    },
    items: AvailabilityRequestDto['items'],
    pets: { id: string; species: string; size: string; breed: string }[],
    services: { id: string; name: string; speciesSupported: string[] }[],
    locationType: string,
  ) {
    const serviceMap = new Map(services.map((s) => [s.id, s]));
    const petMap = new Map(pets.map((p) => [p.id, p]));

    // Batch fetch all duration rules — fixes N+1
    const allRules = await this.ruleRepo.findByServiceIds([
      ...new Set(items.map((i) => i.serviceId)),
    ]);
    const rulesByService = new Map<string, typeof allRules>();
    for (const rule of allRules) {
      if (!rulesByService.has(rule.serviceId))
        rulesByService.set(rule.serviceId, []);
      rulesByService.get(rule.serviceId)!.push(rule);
    }

    let totalMinutes = 0;
    let dogCount = 0;

    for (const item of items) {
      const pet = petMap.get(item.petId);
      const service = serviceMap.get(item.serviceId);
      if (!pet || !service)
        throw new BadRequestException('Invalid pet or service selection.');

      if (!service.speciesSupported.includes(pet.species as PetSpecies)) {
        throw new BadRequestException(
          `Service ${service.name} does not support ${pet.species}.`,
        );
      }
      if (pet.species === PetSpecies.DOG) dogCount += 1;

      const rules = rulesByService.get(item.serviceId) ?? [];
      try {
        totalMinutes += resolveDurationMinutes(rules, {
          species: pet.species as 'DOG' | 'CAT',
          size: pet.size as PetSize,
          breed: pet.breed,
        });
      } catch (error) {
        throw new BadRequestException((error as Error).message);
      }
    }

    if (
      locationType === ServiceLocation.AT_HOME &&
      business.maxDogsPerHomeVisit &&
      dogCount > business.maxDogsPerHomeVisit
    ) {
      throw new BadRequestException(
        `Max dogs per home visit is ${business.maxDogsPerHomeVisit}.`,
      );
    }
    if (locationType === ServiceLocation.AT_HOME) {
      totalMinutes +=
        business.homeVisitSetupMinutes +
        business.homeVisitTeardownMinutes +
        business.defaultTransportMinutes;
    }

    return totalMinutes;
  }

  private async buildAvailability(
    business: { id: string },
    date: string,
    durationMinutes: number,
    groomerId: string,
  ) {
    const dayStart = new Date(`${date}T00:00:00`);
    if (Number.isNaN(dayStart.getTime()))
      throw new BadRequestException('Invalid date format.');

    const weekday = dayStart.getDay();
    const workingHours = await this.businessRepo.getWorkingHours(business.id);
    const hoursForDay = workingHours.filter((h) => h.weekday === weekday);
    if (hoursForDay.length === 0) return [];

    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const existingAppointments = await this.appointmentRepo.findOverlapping(
      business.id,
      groomerId,
      dayStart,
      dayEnd,
    );
    const slots: string[] = [];

    for (const hours of hoursForDay) {
      const [sh, sm] = hours.startTime.split(':').map(Number);
      const [eh, em] = hours.endTime.split(':').map(Number);
      const blockStart = new Date(dayStart);
      blockStart.setHours(sh, sm, 0, 0);
      const blockEnd = new Date(dayStart);
      blockEnd.setHours(eh, em, 0, 0);

      let slotStart = new Date(blockStart);
      while (
        slotStart.getTime() + durationMinutes * 60000 <=
        blockEnd.getTime()
      ) {
        const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60000);
        if (!hasOverlap(existingAppointments, slotStart, slotEnd)) {
          slots.push(slotStart.toISOString());
        }
        slotStart = new Date(slotStart.getTime() + SLOT_STEP_MINUTES * 60000);
      }
    }

    return slots;
  }

  private async resolveGroomerId(
    businessId: string,
    ownerUserId: string,
    groomerId?: string,
  ) {
    if (!groomerId) {
      const count = await this.staffRepo.countActiveByBusinessId(businessId);
      if (count > 0)
        throw new BadRequestException(
          'groomerId is required for this business.',
        );
      return ownerUserId;
    }
    if (groomerId === ownerUserId) return groomerId;
    const staff = await this.staffRepo.findByBusinessAndUserId(
      businessId,
      groomerId,
    );
    if (!staff) throw new BadRequestException('Invalid groomer selection.');
    return groomerId;
  }

  private validateLocationSupported(
    business: { offersInSalon: boolean; offersAtHome: boolean },
    locationType: string,
  ) {
    if (locationType === ServiceLocation.IN_SALON && !business.offersInSalon) {
      throw new BadRequestException(
        'Business does not offer in-salon services.',
      );
    }
    if (locationType === ServiceLocation.AT_HOME && !business.offersAtHome) {
      throw new BadRequestException(
        'Business does not offer at-home services.',
      );
    }
  }
}
