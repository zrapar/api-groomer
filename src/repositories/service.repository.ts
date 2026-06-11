import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE_DB } from '../db/db.module';
import * as schema from '../db/schema';

type NewService = typeof schema.services.$inferInsert;

@Injectable()
export class ServiceRepository {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findById(id: string) {
    const [service] = await this.db
      .select()
      .from(schema.services)
      .where(eq(schema.services.id, id));
    return service ?? null;
  }

  async findByIds(ids: string[]) {
    if (ids.length === 0) return [];
    return this.db
      .select()
      .from(schema.services)
      .where(inArray(schema.services.id, ids));
  }

  async findByBusinessId(businessId: string, limit = 100, offset = 0) {
    return this.db
      .select()
      .from(schema.services)
      .where(eq(schema.services.businessId, businessId))
      .limit(limit)
      .offset(offset);
  }

  async findActiveByBusinessId(businessId: string) {
    return this.db
      .select()
      .from(schema.services)
      .where(
        and(
          eq(schema.services.businessId, businessId),
          eq(schema.services.isActive, true),
        ),
      );
  }

  async create(
    businessId: string,
    data: Omit<NewService, 'id' | 'businessId' | 'createdAt' | 'updatedAt'>,
  ) {
    const [service] = await this.db
      .insert(schema.services)
      .values({ ...data, businessId })
      .returning();
    return service;
  }

  async update(
    id: string,
    data: Partial<Omit<NewService, 'id' | 'businessId' | 'createdAt'>>,
  ) {
    const [service] = await this.db
      .update(schema.services)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.services.id, id))
      .returning();
    return service;
  }

  async deactivate(id: string) {
    const [service] = await this.db
      .update(schema.services)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(schema.services.id, id))
      .returning();
    return service;
  }
}
