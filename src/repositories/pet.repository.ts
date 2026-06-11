import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE_DB } from '../db/db.module';
import * as schema from '../db/schema';

type NewPet = typeof schema.pets.$inferInsert;

@Injectable()
export class PetRepository {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findById(id: string) {
    const [pet] = await this.db
      .select()
      .from(schema.pets)
      .where(eq(schema.pets.id, id));
    return pet ?? null;
  }

  async findByIds(ids: string[]) {
    if (ids.length === 0) return [];
    return this.db
      .select()
      .from(schema.pets)
      .where(inArray(schema.pets.id, ids));
  }

  async findByOwnerId(ownerId: string, limit = 100, offset = 0) {
    return this.db
      .select()
      .from(schema.pets)
      .where(eq(schema.pets.ownerUserId, ownerId))
      .limit(limit)
      .offset(offset);
  }

  async create(
    ownerId: string,
    data: Omit<NewPet, 'id' | 'ownerUserId' | 'createdAt' | 'updatedAt'>,
  ) {
    const [pet] = await this.db
      .insert(schema.pets)
      .values({ ...data, ownerUserId: ownerId })
      .returning();
    return pet;
  }

  async update(
    id: string,
    data: Partial<Omit<NewPet, 'id' | 'ownerUserId' | 'createdAt'>>,
  ) {
    const [pet] = await this.db
      .update(schema.pets)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.pets.id, id))
      .returning();
    return pet;
  }

  async delete(id: string, ownerId: string) {
    await this.db
      .delete(schema.pets)
      .where(and(eq(schema.pets.id, id), eq(schema.pets.ownerUserId, ownerId)));
  }
}
