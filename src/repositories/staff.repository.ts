import { Inject, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE_DB } from '../db/db.module';
import * as schema from '../db/schema';

@Injectable()
export class StaffRepository {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findById(id: string) {
    const [member] = await this.db
      .select()
      .from(schema.groomerStaffMembers)
      .where(eq(schema.groomerStaffMembers.id, id));
    return member ?? null;
  }

  async findByBusinessId(businessId: string) {
    return this.db
      .select({
        id: schema.groomerStaffMembers.id,
        userId: schema.groomerStaffMembers.userId,
        displayName: schema.groomerStaffMembers.displayName,
        isActive: schema.groomerStaffMembers.isActive,
        email: schema.users.email,
      })
      .from(schema.groomerStaffMembers)
      .innerJoin(
        schema.users,
        eq(schema.users.id, schema.groomerStaffMembers.userId),
      )
      .where(eq(schema.groomerStaffMembers.businessId, businessId));
  }

  async findActiveByBusinessId(businessId: string) {
    return this.db
      .select({
        id: schema.groomerStaffMembers.id,
        userId: schema.groomerStaffMembers.userId,
        displayName: schema.groomerStaffMembers.displayName,
        email: schema.users.email,
      })
      .from(schema.groomerStaffMembers)
      .innerJoin(
        schema.users,
        eq(schema.users.id, schema.groomerStaffMembers.userId),
      )
      .where(
        and(
          eq(schema.groomerStaffMembers.businessId, businessId),
          eq(schema.groomerStaffMembers.isActive, true),
        ),
      );
  }

  async findByBusinessAndUserId(businessId: string, userId: string) {
    const [member] = await this.db
      .select()
      .from(schema.groomerStaffMembers)
      .where(
        and(
          eq(schema.groomerStaffMembers.businessId, businessId),
          eq(schema.groomerStaffMembers.userId, userId),
        ),
      );
    return member ?? null;
  }

  async countActiveByBusinessId(businessId: string) {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.groomerStaffMembers)
      .where(
        and(
          eq(schema.groomerStaffMembers.businessId, businessId),
          eq(schema.groomerStaffMembers.isActive, true),
        ),
      );
    return Number(row?.count ?? 0);
  }

  async create(businessId: string, userId: string, displayName: string) {
    const [member] = await this.db
      .insert(schema.groomerStaffMembers)
      .values({ businessId, userId, displayName, isActive: true })
      .returning();
    return member;
  }

  async update(id: string, data: { displayName?: string; isActive?: boolean }) {
    const [member] = await this.db
      .update(schema.groomerStaffMembers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.groomerStaffMembers.id, id))
      .returning();
    return member;
  }

  async delete(id: string) {
    await this.db
      .delete(schema.groomerStaffMembers)
      .where(eq(schema.groomerStaffMembers.id, id));
  }
}
