import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, eq, gt, inArray, lt } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { DRIZZLE_DB } from "../db/db.module";
import * as schema from "../db/schema";
import { AuthUser } from "../auth/types/auth-user";
import { UserRole } from "../auth/dto/user-role.enum";
import { CreateAppointmentDto } from "./dto/create-appointment.dto";
import { UpdateAppointmentStatusDto } from "./dto/update-appointment-status.dto";
import { UpdateAppointmentDto } from "./dto/update-appointment.dto";
import { AppointmentStatus } from "./dto/appointment.enums";
import { ServiceLocation } from "../services/dto/service.enums";
import { PetSize, PetSpecies } from "../pets/dto/pet.enums";
import { NotificationService } from "../notifications/notification.service";
import { resolveDurationMinutes } from "../shared/duration";
import { hasOverlap } from "../shared/overlap";

@Injectable()
export class AppointmentsService {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly notifications: NotificationService,
  ) {}

  async create(user: AuthUser, payload: CreateAppointmentDto) {
    if (user.role !== UserRole.CLIENT) {
      throw new ForbiddenException("Only clients can create appointments.");
    }

    const startTime = new Date(payload.startTime);
    if (Number.isNaN(startTime.getTime())) {
      throw new BadRequestException("Invalid startTime format.");
    }

    const business = await this.getBusiness(payload.businessId);
    this.validateLocationSupported(business, payload.locationType);

    if (payload.locationType === ServiceLocation.AT_HOME && !payload.homeAddress) {
      throw new BadRequestException("homeAddress is required for at-home visits.");
    }

    const petIds = payload.items.map((item) => item.petId);
    const serviceIds = payload.items.map((item) => item.serviceId);

    const pets = await this.db
      .select()
      .from(schema.pets)
      .where(inArray(schema.pets.id, petIds));

    if (pets.length !== petIds.length) {
      throw new NotFoundException("One or more pets were not found.");
    }

    const invalidPet = pets.find((pet) => pet.ownerUserId !== user.id);
    if (invalidPet) {
      throw new ForbiddenException("Pets must belong to the current client.");
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

    const { totalMinutes, perItemDurations, dogCount } = await this.calculateTotalDuration(
      business,
      payload.items,
      pets,
      services,
      payload.locationType,
    );

    if (
      payload.locationType === ServiceLocation.AT_HOME &&
      business.maxDogsPerHomeVisit &&
      dogCount > business.maxDogsPerHomeVisit
    ) {
      throw new BadRequestException(
        `Max dogs per home visit is ${business.maxDogsPerHomeVisit}.`,
      );
    }

    const endTime = new Date(startTime.getTime() + totalMinutes * 60000);

    await this.ensureNoOverlap(business.id, startTime, endTime);

    return this.db.transaction(async (tx) => {
      const [appointment] = await tx
        .insert(schema.appointments)
        .values({
          businessId: business.id,
          clientId: user.id,
          locationType: payload.locationType,
          startTime,
          endTime,
          status: AppointmentStatus.PENDING,
          homeAddress: payload.homeAddress,
          homeZone: payload.homeZone,
        })
        .returning();

      await tx.insert(schema.appointmentPets).values(
        payload.items.map((item) => ({
          appointmentId: appointment.id,
          petId: item.petId,
          serviceId: item.serviceId,
          calculatedDurationMinutes: perItemDurations.get(
            `${item.petId}:${item.serviceId}`,
          ) as number,
          extras: item.extras ?? null,
        })),
      );

      await this.notifications.sendEmail(
        user.email,
        `Appointment created for ${appointment.startTime.toISOString()}.`,
      );

      return appointment;
    });
  }

  async list(user: AuthUser) {
    if (user.role === UserRole.CLIENT) {
      const appointments = await this.db
        .select()
        .from(schema.appointments)
        .where(eq(schema.appointments.clientId, user.id));
      return this.buildAppointmentsWithDetails(appointments);
    }

    if (user.role === UserRole.GROOMER_OWNER) {
      const business = await this.getBusinessForOwner(user.id);
      const appointments = await this.db
        .select()
        .from(schema.appointments)
        .where(eq(schema.appointments.businessId, business.id));
      return this.buildAppointmentsWithDetails(appointments);
    }

    throw new ForbiddenException("Unsupported role for listing appointments.");
  }

  async getById(user: AuthUser, appointmentId: string) {
    const [appointment] = await this.db
      .select()
      .from(schema.appointments)
      .where(eq(schema.appointments.id, appointmentId));

    if (!appointment) {
      throw new NotFoundException("Appointment not found.");
    }

    if (user.role === UserRole.CLIENT && appointment.clientId !== user.id) {
      throw new ForbiddenException("You do not have access to this appointment.");
    }

    if (user.role === UserRole.GROOMER_OWNER) {
      const business = await this.getBusinessForOwner(user.id);
      if (appointment.businessId !== business.id) {
        throw new ForbiddenException("You do not have access to this appointment.");
      }
    }

    const [detailed] = await this.buildAppointmentsWithDetails([appointment]);
    return detailed;
  }

  async updateStatus(
    user: AuthUser,
    appointmentId: string,
    payload: UpdateAppointmentStatusDto,
  ) {
    const appointment = await this.getAppointmentForOwner(user, appointmentId);

    const [updated] = await this.db
      .update(schema.appointments)
      .set({
        status: payload.status,
        cancelReason: payload.cancelReason ?? appointment.cancelReason,
        updatedAt: new Date(),
      })
      .where(eq(schema.appointments.id, appointmentId))
      .returning();

    await this.notifications.sendEmail(
      user.email,
      `Appointment ${appointmentId} status changed to ${payload.status}.`,
    );

    return updated;
  }

  async update(
    user: AuthUser,
    appointmentId: string,
    payload: UpdateAppointmentDto,
  ) {
    const [appointment] = await this.db
      .select()
      .from(schema.appointments)
      .where(eq(schema.appointments.id, appointmentId));

    if (!appointment) {
      throw new NotFoundException("Appointment not found.");
    }

    const business = await this.getBusiness(appointment.businessId);

    if (user.role === UserRole.CLIENT) {
      if (appointment.clientId !== user.id) {
        throw new ForbiddenException("You do not have access to this appointment.");
      }
      const hoursDiff =
        (appointment.startTime.getTime() - Date.now()) / 3600000;
      if (hoursDiff < business.minHoursBeforeCancelOrReschedule) {
        throw new BadRequestException("Too late to reschedule this appointment.");
      }
    }

    if (user.role === UserRole.GROOMER_OWNER) {
      const ownerBusiness = await this.getBusinessForOwner(user.id);
      if (appointment.businessId !== ownerBusiness.id) {
        throw new ForbiddenException("You do not have access to this appointment.");
      }
    }

    let newStartTime = appointment.startTime;
    let newEndTime = appointment.endTime;

    if (payload.startTime) {
      const parsedStart = new Date(payload.startTime);
      if (Number.isNaN(parsedStart.getTime())) {
        throw new BadRequestException("Invalid startTime format.");
      }
      newStartTime = parsedStart;
      const durationMinutes = Math.round(
        (appointment.endTime.getTime() - appointment.startTime.getTime()) / 60000,
      );
      newEndTime = new Date(parsedStart.getTime() + durationMinutes * 60000);
      await this.ensureNoOverlap(appointment.businessId, newStartTime, newEndTime, appointment.id);
    }

    const [updated] = await this.db
      .update(schema.appointments)
      .set({
        startTime: newStartTime,
        endTime: newEndTime,
        homeAddress: payload.homeAddress ?? appointment.homeAddress,
        homeZone: payload.homeZone ?? appointment.homeZone,
        updatedAt: new Date(),
      })
      .where(eq(schema.appointments.id, appointmentId))
      .returning();

    return updated;
  }

  private async calculateTotalDuration(
    business: typeof schema.groomerBusinesses.$inferSelect,
    items: CreateAppointmentDto["items"],
    pets: typeof schema.pets.$inferSelect[],
    services: typeof schema.services.$inferSelect[],
    locationType: ServiceLocation,
  ) {
    const serviceMap = new Map(services.map((service) => [service.id, service]));
    const petMap = new Map(pets.map((pet) => [pet.id, pet]));

    let totalMinutes = 0;
    let dogCount = 0;
    const perItemDurations = new Map<string, number>();

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
      perItemDurations.set(`${item.petId}:${item.serviceId}`, duration);
      totalMinutes += duration;
    }

    if (locationType === ServiceLocation.AT_HOME) {
      totalMinutes +=
        business.homeVisitSetupMinutes +
        business.homeVisitTeardownMinutes +
        business.defaultTransportMinutes;
    }

    return { totalMinutes, perItemDurations, dogCount };
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

  private async ensureNoOverlap(
    businessId: string,
    startTime: Date,
    endTime: Date,
    excludeAppointmentId?: string,
  ) {
    const overlaps = await this.db
      .select({
        id: schema.appointments.id,
        status: schema.appointments.status,
        startTime: schema.appointments.startTime,
        endTime: schema.appointments.endTime,
      })
      .from(schema.appointments)
      .where(
        and(
          eq(schema.appointments.businessId, businessId),
          lt(schema.appointments.startTime, endTime),
          gt(schema.appointments.endTime, startTime),
        ),
      );
    if (hasOverlap(overlaps, startTime, endTime, excludeAppointmentId)) {
      throw new BadRequestException("Time slot is not available.");
    }
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

  private async getBusinessForOwner(ownerId: string) {
    const [business] = await this.db
      .select()
      .from(schema.groomerBusinesses)
      .where(eq(schema.groomerBusinesses.ownerUserId, ownerId));

    if (!business) {
      throw new NotFoundException("Business not found for this owner.");
    }

    return business;
  }

  private async getAppointmentForOwner(user: AuthUser, appointmentId: string) {
    if (user.role !== UserRole.GROOMER_OWNER) {
      throw new ForbiddenException("Only groomers can update status.");
    }

    const business = await this.getBusinessForOwner(user.id);
    const [appointment] = await this.db
      .select()
      .from(schema.appointments)
      .where(eq(schema.appointments.id, appointmentId));

    if (!appointment) {
      throw new NotFoundException("Appointment not found.");
    }

    if (appointment.businessId !== business.id) {
      throw new ForbiddenException("Appointment does not belong to this business.");
    }

    return appointment;
  }

  private async buildAppointmentsWithDetails(
    appointments: (typeof schema.appointments.$inferSelect)[],
  ) {
    if (appointments.length === 0) {
      return [];
    }

    const appointmentIds = appointments.map((appt) => appt.id);
    const rows = await this.db
      .select({
        appointment: schema.appointments,
        appointmentPet: schema.appointmentPets,
        pet: schema.pets,
        service: schema.services,
        client: schema.users,
        business: schema.groomerBusinesses,
      })
      .from(schema.appointments)
      .leftJoin(
        schema.users,
        eq(schema.users.id, schema.appointments.clientId),
      )
      .leftJoin(
        schema.groomerBusinesses,
        eq(schema.groomerBusinesses.id, schema.appointments.businessId),
      )
      .leftJoin(
        schema.appointmentPets,
        eq(schema.appointmentPets.appointmentId, schema.appointments.id),
      )
      .leftJoin(schema.pets, eq(schema.pets.id, schema.appointmentPets.petId))
      .leftJoin(
        schema.services,
        eq(schema.services.id, schema.appointmentPets.serviceId),
      )
      .where(inArray(schema.appointments.id, appointmentIds));

    const grouped = new Map<
      string,
      typeof schema.appointments.$inferSelect & {
        client: {
          id: string;
          email: string;
          role: string;
        } | null;
        business: {
          id: string;
          name: string;
          phone: string;
          email: string | null;
        } | null;
        items: Array<{
          appointmentPet: typeof schema.appointmentPets.$inferSelect;
          pet: typeof schema.pets.$inferSelect | null;
          service: typeof schema.services.$inferSelect | null;
        }>;
      }
    >();

    for (const appointment of appointments) {
      grouped.set(appointment.id, {
        ...appointment,
        client: null,
        business: null,
        items: [],
      });
    }

    for (const row of rows) {
      const current = grouped.get(row.appointment.id);
      if (!current || !row.appointmentPet) {
        if (current && row.client && row.business) {
          current.client = {
            id: row.client.id,
            email: row.client.email,
            role: row.client.role,
          };
          current.business = {
            id: row.business.id,
            name: row.business.name,
            phone: row.business.phone,
            email: row.business.email,
          };
        }
        continue;
      }
      if (row.client && row.business) {
        current.client = {
          id: row.client.id,
          email: row.client.email,
          role: row.client.role,
        };
        current.business = {
          id: row.business.id,
          name: row.business.name,
          phone: row.business.phone,
          email: row.business.email,
        };
      }
      current.items.push({
        appointmentPet: row.appointmentPet,
        pet: row.pet ?? null,
        service: row.service ?? null,
      });
    }

    return Array.from(grouped.values());
  }
}
