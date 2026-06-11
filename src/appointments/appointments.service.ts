import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BusinessRepository } from '../repositories/business.repository';
import { AppointmentRepository } from '../repositories/appointment.repository';
import { PetRepository } from '../repositories/pet.repository';
import { ServiceRepository } from '../repositories/service.repository';
import { ServiceDurationRuleRepository } from '../repositories/service-duration-rule.repository';
import { StaffRepository } from '../repositories/staff.repository';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { GoogleCalendarService } from '../google-calendar/google-calendar.service';
import {
  APPOINTMENT_EVENTS,
  AppointmentCancelledEvent,
  AppointmentCreatedEvent,
  AppointmentStatusChangedEvent,
} from '../common/events/appointment.events';
import { AuthUser } from '../auth/types/auth-user';
import { UserRole } from '../auth/dto/user-role.enum';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentStatusDto } from './dto/update-appointment-status.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { CancelAppointmentDto } from './dto/cancel-appointment.dto';
import { AppointmentStatus } from './dto/appointment.enums';
import { ServiceLocation } from '../services/dto/service.enums';
import { PetSize, PetSpecies } from '../pets/dto/pet.enums';
import { resolveDurationMinutes } from '../shared/duration';
import { hasOverlap } from '../shared/overlap';
import { PaginationDto } from '../shared/pagination.dto';

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly businessRepo: BusinessRepository,
    private readonly appointmentRepo: AppointmentRepository,
    private readonly petRepo: PetRepository,
    private readonly serviceRepo: ServiceRepository,
    private readonly ruleRepo: ServiceDurationRuleRepository,
    private readonly staffRepo: StaffRepository,
    private readonly eventEmitter: EventEmitter2,
    private readonly googleCalendar: GoogleCalendarService,
  ) {}

  async create(user: AuthUser, payload: CreateAppointmentDto) {
    if (user.role !== UserRole.CLIENT) {
      throw new ForbiddenException('Only clients can create appointments.');
    }

    const startTime = new Date(payload.startTime);
    if (Number.isNaN(startTime.getTime())) {
      throw new BadRequestException('Invalid startTime format.');
    }
    if (startTime <= new Date()) {
      throw new BadRequestException('startTime must be in the future.');
    }

    const business = await this.businessRepo.findById(payload.businessId);
    if (!business) throw new NotFoundException('Business not found.');
    this.validateLocationSupported(business, payload.locationType);

    if (
      payload.locationType === ServiceLocation.AT_HOME &&
      !payload.homeAddress
    ) {
      throw new BadRequestException(
        'homeAddress is required for at-home visits.',
      );
    }

    const groomerId = await this.resolveGroomerId(
      business.id,
      business.ownerUserId,
      payload.groomerId,
    );

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

    const invalidPet = pets.find((p) => p.ownerUserId !== user.id);
    if (invalidPet)
      throw new ForbiddenException('Pets must belong to the current client.');

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

    const { totalMinutes, perItemDurations, dogCount } =
      await this.calculateTotalDuration(
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

    try {
      const created = await this.appointmentRepo.create(
        {
          businessId: business.id,
          clientId: user.id,
          locationType: payload.locationType,
          groomerId,
          startTime,
          endTime,
          status: AppointmentStatus.PENDING,
          homeAddress: payload.homeAddress,
          homeZone: payload.homeZone,
        },
        payload.items.map((item) => ({
          petId: item.petId,
          serviceId: item.serviceId,
          calculatedDurationMinutes: perItemDurations.get(
            `${item.petId}:${item.serviceId}`,
          ) as number,
          extras: item.extras ?? null,
        })),
      );

      this.eventEmitter.emit(
        APPOINTMENT_EVENTS.CREATED,
        new AppointmentCreatedEvent(created.id, user.email, created.startTime),
      );
      void this.googleCalendar.syncAppointment(created.id).catch((e) => void e);
      return created;
    } catch (error) {
      if ((error as Error).message === 'OVERLAP') {
        throw new BadRequestException('Time slot is not available.');
      }
      throw error;
    }
  }

  async list(user: AuthUser, pagination: PaginationDto) {
    const { limit = 100, offset = 0 } = pagination;

    if (user.role === UserRole.CLIENT) {
      const appointments = await this.appointmentRepo.findByClientId(
        user.id,
        limit,
        offset,
      );
      return this.appointmentRepo.findWithDetails(
        appointments.map((a) => a.id),
      );
    }

    if (user.role === UserRole.GROOMER_OWNER) {
      const business = await this.businessRepo.findByOwnerId(user.id);
      if (!business) throw new NotFoundException('Business not found.');
      const appointments = await this.appointmentRepo.findByBusinessId(
        business.id,
        limit,
        offset,
      );
      return this.appointmentRepo.findWithDetails(
        appointments.map((a) => a.id),
      );
    }

    if (user.role === UserRole.GROOMER_STAFF) {
      const appointments = await this.appointmentRepo.findByGroomerId(
        user.id,
        limit,
        offset,
      );
      return this.appointmentRepo.findWithDetails(
        appointments.map((a) => a.id),
      );
    }

    throw new ForbiddenException('Unsupported role for listing appointments.');
  }

  async getById(user: AuthUser, appointmentId: string) {
    const appointment = await this.appointmentRepo.findById(appointmentId);
    if (!appointment) throw new NotFoundException('Appointment not found.');

    if (user.role === UserRole.CLIENT && appointment.clientId !== user.id) {
      throw new ForbiddenException(
        'You do not have access to this appointment.',
      );
    }
    if (user.role === UserRole.GROOMER_OWNER) {
      const business = await this.businessRepo.findByOwnerId(user.id);
      if (!business || appointment.businessId !== business.id) {
        throw new ForbiddenException(
          'You do not have access to this appointment.',
        );
      }
    }
    if (
      user.role === UserRole.GROOMER_STAFF &&
      appointment.groomerId !== user.id
    ) {
      throw new ForbiddenException(
        'You do not have access to this appointment.',
      );
    }

    return this.appointmentRepo.findWithDetailsById(appointmentId);
  }

  async updateStatus(
    user: AuthUser,
    appointmentId: string,
    payload: UpdateAppointmentStatusDto,
  ) {
    const appointment = await this.getAppointmentForGroomer(
      user,
      appointmentId,
    );
    const updated = await this.appointmentRepo.update(appointmentId, {
      status: payload.status,
      cancelReason: payload.cancelReason ?? appointment.cancelReason,
    });

    this.eventEmitter.emit(
      APPOINTMENT_EVENTS.STATUS_CHANGED,
      new AppointmentStatusChangedEvent(
        appointmentId,
        user.email,
        payload.status,
      ),
    );
    void this.googleCalendar.syncAppointment(updated.id).catch((e) => void e);
    return updated;
  }

  async cancel(
    user: AuthUser,
    appointmentId: string,
    payload: CancelAppointmentDto,
  ) {
    const appointment = await this.appointmentRepo.findById(appointmentId);
    if (!appointment) throw new NotFoundException('Appointment not found.');

    if (appointment.status === AppointmentStatus.CANCELLED) return appointment;

    const business = await this.businessRepo.findById(appointment.businessId);
    if (!business) throw new NotFoundException('Business not found.');

    if (user.role === UserRole.CLIENT) {
      if (appointment.clientId !== user.id)
        throw new ForbiddenException(
          'You do not have access to this appointment.',
        );
      if (
        ![AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED].includes(
          appointment.status as AppointmentStatus,
        )
      ) {
        throw new BadRequestException('Appointment cannot be cancelled.');
      }
      const hoursDiff =
        (appointment.startTime.getTime() - Date.now()) / 3600000;
      if (hoursDiff < business.minHoursBeforeCancelOrReschedule) {
        throw new BadRequestException('Too late to cancel this appointment.');
      }
    }

    if (
      user.role === UserRole.GROOMER_OWNER &&
      business.ownerUserId !== user.id
    ) {
      throw new ForbiddenException(
        'You do not have access to this appointment.',
      );
    }
    if (
      user.role === UserRole.GROOMER_STAFF &&
      appointment.groomerId !== user.id
    ) {
      throw new ForbiddenException(
        'You do not have access to this appointment.',
      );
    }

    const updated = await this.appointmentRepo.update(appointmentId, {
      status: AppointmentStatus.CANCELLED,
      cancelReason: payload.cancelReason ?? appointment.cancelReason,
    });

    this.eventEmitter.emit(
      APPOINTMENT_EVENTS.CANCELLED,
      new AppointmentCancelledEvent(appointmentId, user.email),
    );
    void this.googleCalendar.syncAppointment(updated.id).catch((e) => void e);
    return updated;
  }

  async update(
    user: AuthUser,
    appointmentId: string,
    payload: UpdateAppointmentDto,
  ) {
    const appointment = await this.appointmentRepo.findById(appointmentId);
    if (!appointment) throw new NotFoundException('Appointment not found.');

    const nonReschedulableStatuses = [
      AppointmentStatus.DONE,
      AppointmentStatus.CANCELLED,
      AppointmentStatus.NO_SHOW,
    ];
    if (
      nonReschedulableStatuses.includes(appointment.status as AppointmentStatus)
    ) {
      throw new BadRequestException(
        `Cannot reschedule an appointment with status ${appointment.status}.`,
      );
    }

    const business = await this.businessRepo.findById(appointment.businessId);
    if (!business) throw new NotFoundException('Business not found.');

    if (user.role === UserRole.CLIENT) {
      if (appointment.clientId !== user.id)
        throw new ForbiddenException(
          'You do not have access to this appointment.',
        );
      const hoursDiff =
        (appointment.startTime.getTime() - Date.now()) / 3600000;
      if (hoursDiff < business.minHoursBeforeCancelOrReschedule) {
        throw new BadRequestException(
          'Too late to reschedule this appointment.',
        );
      }
    }
    if (
      user.role === UserRole.GROOMER_OWNER &&
      business.ownerUserId !== user.id
    ) {
      throw new ForbiddenException(
        'You do not have access to this appointment.',
      );
    }
    if (
      user.role === UserRole.GROOMER_STAFF &&
      appointment.groomerId !== user.id
    ) {
      throw new ForbiddenException(
        'You do not have access to this appointment.',
      );
    }

    let newStartTime = appointment.startTime;
    let newEndTime = appointment.endTime;

    if (payload.startTime) {
      const parsedStart = new Date(payload.startTime);
      if (Number.isNaN(parsedStart.getTime()))
        throw new BadRequestException('Invalid startTime format.');
      newStartTime = parsedStart;
      const durationMs =
        appointment.endTime.getTime() - appointment.startTime.getTime();
      newEndTime = new Date(parsedStart.getTime() + durationMs);

      const assignedGroomerId = appointment.groomerId ?? business.ownerUserId;
      const overlapping = await this.appointmentRepo.findOverlapping(
        appointment.businessId,
        assignedGroomerId,
        newStartTime,
        newEndTime,
      );
      if (hasOverlap(overlapping, newStartTime, newEndTime, appointment.id)) {
        throw new BadRequestException('Time slot is not available.');
      }
    }

    const updated = await this.appointmentRepo.update(appointmentId, {
      startTime: newStartTime,
      endTime: newEndTime,
      homeAddress: payload.homeAddress ?? appointment.homeAddress,
      homeZone: payload.homeZone ?? appointment.homeZone,
    });

    void this.googleCalendar.syncAppointment(updated.id).catch((e) => void e);
    return updated;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async calculateTotalDuration(
    business: {
      id: string;
      homeVisitSetupMinutes: number;
      homeVisitTeardownMinutes: number;
      defaultTransportMinutes: number;
      maxDogsPerHomeVisit: number | null;
    },
    items: CreateAppointmentDto['items'],
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
    const perItemDurations = new Map<string, number>();

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
        const duration = resolveDurationMinutes(rules, {
          species: pet.species as 'DOG' | 'CAT',
          size: pet.size as PetSize,
          breed: pet.breed,
        });
        perItemDurations.set(`${item.petId}:${item.serviceId}`, duration);
        totalMinutes += duration;
      } catch (error) {
        throw new BadRequestException((error as Error).message);
      }
    }

    if (locationType === ServiceLocation.AT_HOME) {
      totalMinutes +=
        business.homeVisitSetupMinutes +
        business.homeVisitTeardownMinutes +
        business.defaultTransportMinutes;
    }

    return { totalMinutes, perItemDurations, dogCount };
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

  private async getAppointmentForGroomer(
    user: AuthUser,
    appointmentId: string,
  ) {
    if (![UserRole.GROOMER_OWNER, UserRole.GROOMER_STAFF].includes(user.role)) {
      throw new ForbiddenException('Only groomers can update status.');
    }
    const appointment = await this.appointmentRepo.findById(appointmentId);
    if (!appointment) throw new NotFoundException('Appointment not found.');

    if (user.role === UserRole.GROOMER_OWNER) {
      const business = await this.businessRepo.findByOwnerId(user.id);
      if (!business || appointment.businessId !== business.id) {
        throw new ForbiddenException(
          'Appointment does not belong to this business.',
        );
      }
    } else if (appointment.groomerId !== user.id) {
      throw new ForbiddenException(
        'Appointment does not belong to this groomer.',
      );
    }

    return appointment;
  }
}
