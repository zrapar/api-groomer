import { Inject, Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE_DB } from '../db/db.module';
import * as schema from '../db/schema';

type NewBusiness = typeof schema.groomerBusinesses.$inferInsert;
type WorkingHourInput = { weekday: number; startTime: string; endTime: string };

export const PUBLIC_BUSINESS_COLUMNS = {
  id: schema.groomerBusinesses.id,
  name: schema.groomerBusinesses.name,
  slug: schema.groomerBusinesses.slug,
  description: schema.groomerBusinesses.description,
  logoUrl: schema.groomerBusinesses.logoUrl,
  coverImageUrl: schema.groomerBusinesses.coverImageUrl,
  address: schema.groomerBusinesses.address,
  phone: schema.groomerBusinesses.phone,
  email: schema.groomerBusinesses.email,
  offersInSalon: schema.groomerBusinesses.offersInSalon,
  offersAtHome: schema.groomerBusinesses.offersAtHome,
  maxDogsPerHomeVisit: schema.groomerBusinesses.maxDogsPerHomeVisit,
  minHoursBeforeCancelOrReschedule:
    schema.groomerBusinesses.minHoursBeforeCancelOrReschedule,
  plan: schema.groomerBusinesses.plan,
  latitude: schema.groomerBusinesses.latitude,
  longitude: schema.groomerBusinesses.longitude,
} as const;

@Injectable()
export class BusinessRepository {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findById(id: string) {
    const [business] = await this.db
      .select()
      .from(schema.groomerBusinesses)
      .where(eq(schema.groomerBusinesses.id, id));
    return business ?? null;
  }

  async findByOwnerId(ownerId: string) {
    const [business] = await this.db
      .select()
      .from(schema.groomerBusinesses)
      .where(eq(schema.groomerBusinesses.ownerUserId, ownerId));
    return business ?? null;
  }

  async findBySlug(slug: string) {
    const [business] = await this.db
      .select(PUBLIC_BUSINESS_COLUMNS)
      .from(schema.groomerBusinesses)
      .where(eq(schema.groomerBusinesses.slug, slug));
    return business ?? null;
  }

  async findAll(limit = 100, offset = 0) {
    return this.db
      .select(PUBLIC_BUSINESS_COLUMNS)
      .from(schema.groomerBusinesses)
      .orderBy(asc(schema.groomerBusinesses.name))
      .limit(limit)
      .offset(offset);
  }

  async create(
    ownerId: string,
    data: Omit<NewBusiness, 'id' | 'ownerUserId' | 'createdAt' | 'updatedAt'>,
    workingHours?: WorkingHourInput[],
  ) {
    return this.db.transaction(async (tx) => {
      const [business] = await tx
        .insert(schema.groomerBusinesses)
        .values({ ...data, ownerUserId: ownerId })
        .returning();

      if (workingHours && workingHours.length > 0) {
        await tx
          .insert(schema.businessWorkingHours)
          .values(workingHours.map((h) => ({ businessId: business.id, ...h })));
      }

      return business;
    });
  }

  async update(
    id: string,
    data: Partial<Omit<NewBusiness, 'id' | 'ownerUserId' | 'createdAt'>>,
    workingHours?: WorkingHourInput[],
  ) {
    return this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(schema.groomerBusinesses)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(schema.groomerBusinesses.id, id))
        .returning();

      if (workingHours !== undefined) {
        await tx
          .delete(schema.businessWorkingHours)
          .where(eq(schema.businessWorkingHours.businessId, id));

        if (workingHours.length > 0) {
          await tx
            .insert(schema.businessWorkingHours)
            .values(workingHours.map((h) => ({ businessId: id, ...h })));
        }
      }

      const hours = await tx
        .select()
        .from(schema.businessWorkingHours)
        .where(eq(schema.businessWorkingHours.businessId, id));

      return { ...updated, workingHours: hours };
    });
  }

  async updateGoogleTokens(
    id: string,
    tokens: {
      refreshToken?: string | null;
      accessToken?: string | null;
      tokenExpiry?: Date | null;
      calendarId?: string | null;
      accountEmail?: string | null;
    },
  ) {
    await this.db
      .update(schema.groomerBusinesses)
      .set({
        googleRefreshToken: tokens.refreshToken,
        googleAccessToken: tokens.accessToken,
        googleTokenExpiry: tokens.tokenExpiry,
        googleCalendarId: tokens.calendarId,
        googleAccountEmail: tokens.accountEmail,
        updatedAt: new Date(),
      })
      .where(eq(schema.groomerBusinesses.id, id));
  }

  async clearGoogleTokens(id: string) {
    await this.db
      .update(schema.groomerBusinesses)
      .set({
        googleRefreshToken: null,
        googleAccessToken: null,
        googleTokenExpiry: null,
        googleCalendarId: null,
        googleAccountEmail: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.groomerBusinesses.id, id));
  }

  async getWorkingHours(businessId: string) {
    return this.db
      .select()
      .from(schema.businessWorkingHours)
      .where(eq(schema.businessWorkingHours.businessId, businessId));
  }

  async getWithWorkingHours(ownerId: string) {
    const business = await this.findByOwnerId(ownerId);
    if (!business) return null;
    const workingHours = await this.getWorkingHours(business.id);
    return { ...business, workingHours };
  }
}
