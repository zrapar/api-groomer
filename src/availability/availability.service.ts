import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, eq, inArray, lt, gt } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { DRIZZLE_DB } from "../db/db.module";
import * as schema from "../db/schema";
import { AuthUser } from "../auth/types/auth-user";
import { UserRole } from "../auth/dto/user-role.enum";
import { AvailabilityRequestDto } from "./dto/availability.dto";
import { PetSize, PetSpecies } from "../pets/dto/pet.enums";
import { ServiceLocation } from "../services/dto/service.enums";
import { hasOverlap } from "../shared/overlap";
import { resolveDurationMinutes } from "../shared/duration";

const SLOT_STEP_MINUTES = 15;

@Injectable()
export class AvailabilityService {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async getAvailability(
    user: AuthUser,
    businessId: string,
    payload: AvailabilityRequestDto,
  ) {
    const business = await this.getBusiness(businessId);
    this.validateLocationSupported(business, payload.locationType);

    const items = payload.items;
    const petIds = items.map((item) => item.petId);
    const serviceIds = items.map((item) => item.serviceId);

    const pets = await this.db
      .select()
      .from(schema.pets)
      .where(inArray(schema.pets.id, petIds));

    if (pets.length !== petIds.length) {
      throw new NotFoundException("One or more pets were not found.");
    }

    if (user.role === UserRole.CLIENT) {
      const invalidPet = pets.find((pet) => pet.ownerUserId !== user.id);
      if (invalidPet) {
        throw new BadRequestException("Pets must belong to the current client.");
      }
    }

    const services = await this.db
      .select()
      .from(schema.services)
      .where(inArray(schema.services.id, serviceIds));

    if (services.length !== serviceIds.length) {
      throw new NotFoundException("One or more services were not found.");
    }

    for (const service of services) {
      if (service.businessId !== business.id) {
        throw new BadRequestException("Service does not belong to this business.");
      }
      if (!service.isActive) {
        throw new BadRequestException("Service is not active.");
      }
      if (!service.locationsSupported.includes(payload.locationType)) {
        throw new BadRequestException(
          `Service ${service.name} is not offered for ${payload.locationType}.`,
        );
      }
    }

    const totalDurationMinutes = await this.calculateTotalDuration(
      business,
      items,
      pets,
      services,
      payload.locationType,
    );

    const groomerId = await this.resolveGroomerId(
      business.id,
      business.ownerUserId,
      payload.groomerId,
    );

    const availability = await this.buildAvailability(
      business,
      payload.date,
      totalDurationMinutes,
      groomerId,
    );

    return {
      date: payload.date,
      locationType: payload.locationType,
      durationMinutes: totalDurationMinutes,
      slots: availability,
    };
  }

  private async getBusiness(businessId: string) {
    const [business] = await this.db
      .select()
      .from(schema.groomerBusinesses)
      .where(eq(schema.groomerBusinesses.id, businessId));

    if (!business) {
      throw new NotFoundException("Business not found.");
    }

    return business;
  }

  private validateLocationSupported(
    business: typeof schema.groomerBusinesses.$inferSelect,
    locationType: ServiceLocation,
  ) {
    if (locationType === ServiceLocation.IN_SALON && !business.offersInSalon) {
      throw new BadRequestException("Business does not offer in-salon services.");
    }
    if (locationType === ServiceLocation.AT_HOME && !business.offersAtHome) {
      throw new BadRequestException("Business does not offer at-home services.");
    }
  }

  private async calculateTotalDuration(
    business: typeof schema.groomerBusinesses.$inferSelect,
    items: AvailabilityRequestDto["items"],
    pets: typeof schema.pets.$inferSelect[],
    services: typeof schema.services.$inferSelect[],
    locationType: ServiceLocation,
  ) {
    const serviceMap = new Map(services.map((service) => [service.id, service]));
    const petMap = new Map(pets.map((pet) => [pet.id, pet]));

    let totalMinutes = 0;
    let dogCount = 0;

    for (const item of items) {
      const pet = petMap.get(item.petId);
      const service = serviceMap.get(item.serviceId);

      if (!pet || !service) {
        throw new BadRequestException("Invalid pet or service selection.");
      }

      if (!service.speciesSupported.includes(pet.species as PetSpecies)) {
        throw new BadRequestException(
          `Service ${service.name} does not support ${pet.species}.`,
        );
      }

      if (pet.species === PetSpecies.DOG) {
        dogCount += 1;
      }

      const duration = await this.getDurationForPet(service.id, pet);
      totalMinutes += duration;
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

  private async getDurationForPet(
    serviceId: string,
    pet: typeof schema.pets.$inferSelect,
  ) {
    const rules = await this.db
      .select()
      .from(schema.serviceDurationRules)
      .where(eq(schema.serviceDurationRules.serviceId, serviceId));

    try {
      return resolveDurationMinutes(rules, {
        species: pet.species,
        size: pet.size,
        breed: pet.breed,
      });
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
  }

  private async buildAvailability(
    business: typeof schema.groomerBusinesses.$inferSelect,
    date: string,
    durationMinutes: number,
    groomerId: string,
  ) {
    const dayStart = new Date(`${date}T00:00:00`);
    if (Number.isNaN(dayStart.getTime())) {
      throw new BadRequestException("Invalid date format.");
    }

    const weekday = dayStart.getDay();
    const workingHours = await this.db
      .select()
      .from(schema.businessWorkingHours)
      .where(eq(schema.businessWorkingHours.businessId, business.id));

    const hoursForDay = workingHours.filter(
      (hour) => hour.weekday === weekday,
    );

    if (hoursForDay.length === 0) {
      return [];
    }

    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const existingAppointments = await this.db
      .select()
      .from(schema.appointments)
      .where(
        and(
          eq(schema.appointments.businessId, business.id),
          eq(schema.appointments.groomerId, groomerId),
          lt(schema.appointments.startTime, dayEnd),
          gt(schema.appointments.endTime, dayStart),
        ),
      );

    const slots: string[] = [];

    for (const hours of hoursForDay) {
      const [startHour, startMinute] = hours.startTime.split(":").map(Number);
      const [endHour, endMinute] = hours.endTime.split(":").map(Number);

      const blockStart = new Date(dayStart);
      blockStart.setHours(startHour, startMinute, 0, 0);

      const blockEnd = new Date(dayStart);
      blockEnd.setHours(endHour, endMinute, 0, 0);

      let slotStart = new Date(blockStart);

      while (slotStart.getTime() + durationMinutes * 60000 <= blockEnd.getTime()) {
        const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60000);

        const overlaps = hasOverlap(existingAppointments, slotStart, slotEnd);

        if (!overlaps) {
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
      const staffCount = await this.db
        .select({ id: schema.groomerStaffMembers.id })
        .from(schema.groomerStaffMembers)
        .where(
          and(
            eq(schema.groomerStaffMembers.businessId, businessId),
            eq(schema.groomerStaffMembers.isActive, true),
          ),
        );
      if (staffCount.length > 0) {
        throw new BadRequestException("groomerId is required for this business.");
      }
      return ownerUserId;
    }

    if (groomerId === ownerUserId) {
      return groomerId;
    }

    const [staff] = await this.db
      .select()
      .from(schema.groomerStaffMembers)
      .where(
        and(
          eq(schema.groomerStaffMembers.businessId, businessId),
          eq(schema.groomerStaffMembers.userId, groomerId),
          eq(schema.groomerStaffMembers.isActive, true),
        ),
      );

    if (!staff) {
      throw new BadRequestException("Invalid groomer selection.");
    }

    return groomerId;
  }
}
