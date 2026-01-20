import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { DRIZZLE_DB } from "../db/db.module";
import * as schema from "../db/schema";
import { AuthUser } from "../auth/types/auth-user";
import { CreateGroomerBusinessDto } from "./dto/create-groomer-business.dto";
import { UpdateGroomerBusinessDto } from "./dto/update-groomer-business.dto";

@Injectable()
export class GroomerBusinessService {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async create(owner: AuthUser, payload: CreateGroomerBusinessDto) {
    if (payload.offersAtHome && !payload.maxDogsPerHomeVisit) {
      throw new BadRequestException(
        "maxDogsPerHomeVisit is required when offersAtHome is true.",
      );
    }

    const existing = await this.db
      .select({ id: schema.groomerBusinesses.id })
      .from(schema.groomerBusinesses)
      .where(eq(schema.groomerBusinesses.ownerUserId, owner.id));

    if (existing.length > 0) {
      throw new BadRequestException("Business already exists for this owner.");
    }

    return this.db.transaction(async (tx) => {
      const [business] = await tx
        .insert(schema.groomerBusinesses)
        .values({
          ownerUserId: owner.id,
          name: payload.name,
          description: payload.description,
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
        })
        .returning();

      if (payload.workingHours && payload.workingHours.length > 0) {
        await tx.insert(schema.businessWorkingHours).values(
          payload.workingHours.map((hour) => ({
            businessId: business.id,
            weekday: hour.weekday,
            startTime: hour.startTime,
            endTime: hour.endTime,
          })),
        );
      }

      return business;
    });
  }

  async getMyBusiness(owner: AuthUser) {
    const [business] = await this.db
      .select()
      .from(schema.groomerBusinesses)
      .where(eq(schema.groomerBusinesses.ownerUserId, owner.id));

    if (!business) {
      throw new NotFoundException("Business not found.");
    }

    const workingHours = await this.db
      .select()
      .from(schema.businessWorkingHours)
      .where(eq(schema.businessWorkingHours.businessId, business.id));

    return { ...business, workingHours };
  }

  async updateMyBusiness(owner: AuthUser, payload: UpdateGroomerBusinessDto) {
    if (payload.offersAtHome && !payload.maxDogsPerHomeVisit) {
      throw new BadRequestException(
        "maxDogsPerHomeVisit is required when offersAtHome is true.",
      );
    }

    return this.db.transaction(async (tx) => {
      const [business] = await tx
        .select()
        .from(schema.groomerBusinesses)
        .where(eq(schema.groomerBusinesses.ownerUserId, owner.id));

      if (!business) {
        throw new NotFoundException("Business not found.");
      }

      const [updated] = await tx
        .update(schema.groomerBusinesses)
        .set({
          name: payload.name ?? business.name,
          description: payload.description ?? business.description,
          phone: payload.phone ?? business.phone,
          email: payload.email ?? business.email,
          address: payload.address ?? business.address,
          latitude:
            payload.latitude !== undefined
              ? String(payload.latitude)
              : business.latitude,
          longitude:
            payload.longitude !== undefined
              ? String(payload.longitude)
              : business.longitude,
          offersInSalon:
            payload.offersInSalon ?? business.offersInSalon,
          offersAtHome: payload.offersAtHome ?? business.offersAtHome,
          maxDogsPerHomeVisit:
            payload.maxDogsPerHomeVisit ?? business.maxDogsPerHomeVisit,
          homeVisitSetupMinutes:
            payload.homeVisitSetupMinutes ?? business.homeVisitSetupMinutes,
          homeVisitTeardownMinutes:
            payload.homeVisitTeardownMinutes ?? business.homeVisitTeardownMinutes,
          defaultTransportMinutes:
            payload.defaultTransportMinutes ?? business.defaultTransportMinutes,
          minHoursBeforeCancelOrReschedule:
            payload.minHoursBeforeCancelOrReschedule ??
            business.minHoursBeforeCancelOrReschedule,
          updatedAt: new Date(),
        })
        .where(eq(schema.groomerBusinesses.id, business.id))
        .returning();

      if (payload.workingHours) {
        await tx
          .delete(schema.businessWorkingHours)
          .where(eq(schema.businessWorkingHours.businessId, business.id));

        if (payload.workingHours.length > 0) {
          await tx.insert(schema.businessWorkingHours).values(
            payload.workingHours.map((hour) => ({
              businessId: business.id,
              weekday: hour.weekday,
              startTime: hour.startTime,
              endTime: hour.endTime,
            })),
          );
        }
      }

      const workingHours = await tx
        .select()
        .from(schema.businessWorkingHours)
        .where(eq(schema.businessWorkingHours.businessId, business.id));

      return { ...updated, workingHours };
    });
  }
}
