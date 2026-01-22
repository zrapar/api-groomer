import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { DRIZZLE_DB } from "../db/db.module";
import * as schema from "../db/schema";

@Injectable()
export class PublicGroomersService {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async getBySlug(slug: string) {
    const [business] = await this.db
      .select()
      .from(schema.groomerBusinesses)
      .where(eq(schema.groomerBusinesses.slug, slug));

    if (!business) {
      throw new NotFoundException("Business not found.");
    }

    const services = await this.db
      .select()
      .from(schema.services)
      .where(eq(schema.services.businessId, business.id));

    return { business, services };
  }

  async getBusiness(businessId: string) {
    const [business] = await this.db
      .select()
      .from(schema.groomerBusinesses)
      .where(eq(schema.groomerBusinesses.id, businessId));

    if (!business) {
      throw new NotFoundException("Business not found.");
    }

    return {
      business: {
        id: business.id,
        name: business.name,
        description: business.description,
        logoUrl: business.logoUrl,
        coverImageUrl: business.coverImageUrl,
        address: business.address,
        offersInSalon: business.offersInSalon,
        offersAtHome: business.offersAtHome,
        maxDogsPerHomeVisit: business.maxDogsPerHomeVisit,
        minHoursBeforeCancelOrReschedule:
          business.minHoursBeforeCancelOrReschedule,
      },
    };
  }

  async getStaff(businessId: string) {
    const [business] = await this.db
      .select()
      .from(schema.groomerBusinesses)
      .where(eq(schema.groomerBusinesses.id, businessId));

    if (!business) {
      throw new NotFoundException("Business not found.");
    }

    const staffRows = await this.db
      .select({
        staff: schema.groomerStaffMembers,
        user: schema.users,
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

    const staff = staffRows.map((row) => ({
      id: row.user.id,
      displayName: row.staff.displayName,
      email: row.user.email,
      isOwner: false,
    }));

    const [owner] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, business.ownerUserId));

    const ownerEntry = owner
      ? {
          id: owner.id,
          displayName: business.name,
          email: owner.email,
          isOwner: true,
        }
      : null;

    return {
      businessId,
      staff: ownerEntry ? [ownerEntry, ...staff] : staff,
    };
  }
}
