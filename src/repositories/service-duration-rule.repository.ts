import { Inject, Injectable } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE_DB } from '../db/db.module';
import * as schema from '../db/schema';

type NewRule = typeof schema.serviceDurationRules.$inferInsert;

@Injectable()
export class ServiceDurationRuleRepository {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findById(id: string) {
    const [rule] = await this.db
      .select()
      .from(schema.serviceDurationRules)
      .where(eq(schema.serviceDurationRules.id, id));
    return rule ?? null;
  }

  async findByServiceId(serviceId: string) {
    return this.db
      .select()
      .from(schema.serviceDurationRules)
      .where(eq(schema.serviceDurationRules.serviceId, serviceId));
  }

  // Batch fetch — fixes N+1 in availability and appointment creation
  async findByServiceIds(serviceIds: string[]) {
    if (serviceIds.length === 0) return [];
    return this.db
      .select()
      .from(schema.serviceDurationRules)
      .where(inArray(schema.serviceDurationRules.serviceId, serviceIds));
  }

  async create(
    serviceId: string,
    data: Omit<NewRule, 'id' | 'serviceId' | 'createdAt' | 'updatedAt'>,
  ) {
    const [rule] = await this.db
      .insert(schema.serviceDurationRules)
      .values({ ...data, serviceId })
      .returning();
    return rule;
  }

  async update(
    id: string,
    data: Partial<Omit<NewRule, 'id' | 'serviceId' | 'createdAt'>>,
  ) {
    const [rule] = await this.db
      .update(schema.serviceDurationRules)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.serviceDurationRules.id, id))
      .returning();
    return rule;
  }

  async delete(id: string) {
    await this.db
      .delete(schema.serviceDurationRules)
      .where(eq(schema.serviceDurationRules.id, id));
  }
}
