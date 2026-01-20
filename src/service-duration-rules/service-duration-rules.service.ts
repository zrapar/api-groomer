import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { DRIZZLE_DB } from "../db/db.module";
import * as schema from "../db/schema";
import { AuthUser } from "../auth/types/auth-user";
import {
  CreateServiceDurationRuleDto,
  UpdateServiceDurationRuleDto,
} from "./dto/service-duration-rule.dto";

@Injectable()
export class ServiceDurationRulesService {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async create(owner: AuthUser, serviceId: string, payload: CreateServiceDurationRuleDto) {
    const service = await this.getServiceForOwner(owner.id, serviceId);

    if (!payload.size && !payload.breed && !payload.isDefaultForSpecies) {
      throw new BadRequestException(
        "Provide size, breed, or set isDefaultForSpecies for a rule.",
      );
    }

    const [rule] = await this.db
      .insert(schema.serviceDurationRules)
      .values({
        serviceId: service.id,
        species: payload.species,
        size: payload.size,
        breed: payload.breed,
        baseDurationMinutes: payload.baseDurationMinutes,
        isDefaultForSpecies: payload.isDefaultForSpecies ?? false,
      })
      .returning();

    return rule;
  }

  async list(owner: AuthUser, serviceId: string) {
    await this.getServiceForOwner(owner.id, serviceId);

    return this.db
      .select()
      .from(schema.serviceDurationRules)
      .where(eq(schema.serviceDurationRules.serviceId, serviceId));
  }

  async update(owner: AuthUser, ruleId: string, payload: UpdateServiceDurationRuleDto) {
    const [rule] = await this.db
      .select()
      .from(schema.serviceDurationRules)
      .where(eq(schema.serviceDurationRules.id, ruleId));

    if (!rule) {
      throw new NotFoundException("Duration rule not found.");
    }

    await this.getServiceForOwner(owner.id, rule.serviceId);

    const [updated] = await this.db
      .update(schema.serviceDurationRules)
      .set({
        species: payload.species ?? rule.species,
        size: payload.size ?? rule.size,
        breed: payload.breed ?? rule.breed,
        baseDurationMinutes: payload.baseDurationMinutes ?? rule.baseDurationMinutes,
        isDefaultForSpecies: payload.isDefaultForSpecies ?? rule.isDefaultForSpecies,
        updatedAt: new Date(),
      })
      .where(eq(schema.serviceDurationRules.id, ruleId))
      .returning();

    return updated;
  }

  async remove(owner: AuthUser, ruleId: string) {
    const [rule] = await this.db
      .select()
      .from(schema.serviceDurationRules)
      .where(eq(schema.serviceDurationRules.id, ruleId));

    if (!rule) {
      throw new NotFoundException("Duration rule not found.");
    }

    await this.getServiceForOwner(owner.id, rule.serviceId);

    await this.db
      .delete(schema.serviceDurationRules)
      .where(eq(schema.serviceDurationRules.id, ruleId));

    return { deleted: true };
  }

  private async getServiceForOwner(ownerId: string, serviceId: string) {
    const [business] = await this.db
      .select()
      .from(schema.groomerBusinesses)
      .where(eq(schema.groomerBusinesses.ownerUserId, ownerId));

    if (!business) {
      throw new NotFoundException("Business not found for this owner.");
    }

    const [service] = await this.db
      .select()
      .from(schema.services)
      .where(eq(schema.services.id, serviceId));

    if (!service) {
      throw new NotFoundException("Service not found.");
    }

    if (service.businessId !== business.id) {
      throw new ForbiddenException("Service does not belong to this owner.");
    }

    return service;
  }
}
