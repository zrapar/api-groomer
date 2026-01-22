import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { hash } from "bcrypt";
import { DRIZZLE_DB } from "../db/db.module";
import * as schema from "../db/schema";
import { UserRole } from "../auth/dto/user-role.enum";
import { CreateStaffDto } from "./dto/create-staff.dto";
import { UpdateStaffDto } from "./dto/update-staff.dto";

@Injectable()
export class StaffService {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async list(ownerId: string) {
    const business = await this.getBusinessForOwner(ownerId);
    const rows = await this.db
      .select({
        staff: schema.groomerStaffMembers,
        user: schema.users,
      })
      .from(schema.groomerStaffMembers)
      .innerJoin(
        schema.users,
        eq(schema.users.id, schema.groomerStaffMembers.userId),
      )
      .where(eq(schema.groomerStaffMembers.businessId, business.id));

    return rows.map((row) => ({
      id: row.staff.id,
      userId: row.staff.userId,
      displayName: row.staff.displayName,
      email: row.user.email,
      isActive: row.staff.isActive,
    }));
  }

  async create(ownerId: string, payload: CreateStaffDto) {
    const business = await this.getBusinessForOwner(ownerId);
    const normalizedEmail = payload.email.toLowerCase();
    const [existingUser] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, normalizedEmail));

    if (existingUser && existingUser.role !== UserRole.GROOMER_STAFF) {
      throw new BadRequestException("Email is already used by another role.");
    }

    const user =
      existingUser ??
      (
        await this.db
          .insert(schema.users)
          .values({
            email: normalizedEmail,
            passwordHash: await hash(
              payload.password ?? this.generateRandomPassword(),
              10,
            ),
            role: UserRole.GROOMER_STAFF,
          })
          .returning()
      )[0];

    const [existingStaff] = await this.db
      .select()
      .from(schema.groomerStaffMembers)
      .where(
        and(
          eq(schema.groomerStaffMembers.businessId, business.id),
          eq(schema.groomerStaffMembers.userId, user.id),
        ),
      );

    if (existingStaff) {
      throw new BadRequestException("Staff member already exists.");
    }

    const [created] = await this.db
      .insert(schema.groomerStaffMembers)
      .values({
        businessId: business.id,
        userId: user.id,
        displayName: payload.displayName,
        isActive: true,
      })
      .returning();

    return created;
  }

  async update(ownerId: string, staffId: string, payload: UpdateStaffDto) {
    const business = await this.getBusinessForOwner(ownerId);
    const [existing] = await this.db
      .select()
      .from(schema.groomerStaffMembers)
      .where(
        and(
          eq(schema.groomerStaffMembers.id, staffId),
          eq(schema.groomerStaffMembers.businessId, business.id),
        ),
      );

    if (!existing) {
      throw new NotFoundException("Staff member not found.");
    }

    const [updated] = await this.db
      .update(schema.groomerStaffMembers)
      .set({
        displayName: payload.displayName ?? existing.displayName,
        isActive: payload.isActive ?? existing.isActive,
        updatedAt: new Date(),
      })
      .where(eq(schema.groomerStaffMembers.id, staffId))
      .returning();

    return updated;
  }

  async deactivate(ownerId: string, staffId: string) {
    return this.update(ownerId, staffId, { isActive: false });
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

  private generateRandomPassword() {
    return Math.random().toString(36).slice(2) + "A1!";
  }
}
