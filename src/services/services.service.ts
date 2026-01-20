import {
  Inject,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { eq, and } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { DRIZZLE_DB } from "../db/db.module";
import * as schema from "../db/schema";
import { AuthUser } from "../auth/types/auth-user";
import { CreateServiceDto } from "./dto/create-service.dto";
import { UpdateServiceDto } from "./dto/update-service.dto";

@Injectable()
export class ServicesService {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async listForOwner(owner: AuthUser) {
    const business = await this.getBusinessForOwner(owner.id);
    return this.db
      .select()
      .from(schema.services)
      .where(eq(schema.services.businessId, business.id));
  }

  async create(owner: AuthUser, payload: CreateServiceDto) {
    const business = await this.getBusinessForOwner(owner.id);

    const [service] = await this.db
      .insert(schema.services)
      .values({
        businessId: business.id,
        name: payload.name,
        description: payload.description,
        speciesSupported: payload.speciesSupported,
        locationsSupported: payload.locationsSupported,
        isActive: payload.isActive,
      })
      .returning();

    return service;
  }

  async update(owner: AuthUser, serviceId: string, payload: UpdateServiceDto) {
    const business = await this.getBusinessForOwner(owner.id);

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

    const [updated] = await this.db
      .update(schema.services)
      .set({
        name: payload.name ?? service.name,
        description: payload.description ?? service.description,
        speciesSupported: payload.speciesSupported ?? service.speciesSupported,
        locationsSupported:
          payload.locationsSupported ?? service.locationsSupported,
        isActive: payload.isActive ?? service.isActive,
        updatedAt: new Date(),
      })
      .where(eq(schema.services.id, serviceId))
      .returning();

    return updated;
  }

  async remove(owner: AuthUser, serviceId: string) {
    const business = await this.getBusinessForOwner(owner.id);

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

    const [updated] = await this.db
      .update(schema.services)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(schema.services.id, serviceId))
      .returning();

    return updated;
  }

  async listPublicServices(businessId: string) {
    return this.db
      .select()
      .from(schema.services)
      .where(and(eq(schema.services.businessId, businessId), eq(schema.services.isActive, true)));
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
}
