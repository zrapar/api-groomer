import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { AnyPgTable } from "drizzle-orm/pg-core";
import { DRIZZLE_DB } from "../db/db.module";
import * as schema from "../db/schema";
import { UserRole } from "../auth/dto/user-role.enum";

@Injectable()
export class AdminService {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async getOverview() {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const [
      usersTotal,
      businessesTotal,
      petsTotal,
      servicesTotal,
      appointmentsTotal,
      usersByRoleRows,
      businessesByPlanRows,
      appointmentsByStatusRows,
      todayAppointments,
      nextWeekAppointments,
      recentUsers,
      recentBusinesses,
      recentAppointments,
    ] = await Promise.all([
      this.countAll(schema.users),
      this.countAll(schema.groomerBusinesses),
      this.countAll(schema.pets),
      this.countAll(schema.services),
      this.countAll(schema.appointments),
      this.db
        .select({
          role: schema.users.role,
          count: sql<number>`count(*)`,
        })
        .from(schema.users)
        .groupBy(schema.users.role),
      this.db
        .select({
          plan: schema.groomerBusinesses.plan,
          count: sql<number>`count(*)`,
        })
        .from(schema.groomerBusinesses)
        .groupBy(schema.groomerBusinesses.plan),
      this.db
        .select({
          status: schema.appointments.status,
          count: sql<number>`count(*)`,
        })
        .from(schema.appointments)
        .groupBy(schema.appointments.status),
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(schema.appointments)
        .where(
          and(
            gte(schema.appointments.startTime, todayStart),
            lte(schema.appointments.startTime, todayEnd),
          ),
        ),
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(schema.appointments)
        .where(
          and(
            gte(schema.appointments.startTime, todayStart),
            lte(schema.appointments.startTime, nextWeek),
          ),
        ),
      this.db
        .select({
          id: schema.users.id,
          email: schema.users.email,
          role: schema.users.role,
          createdAt: schema.users.createdAt,
        })
        .from(schema.users)
        .orderBy(desc(schema.users.createdAt))
        .limit(10),
      this.db
        .select({
          id: schema.groomerBusinesses.id,
          name: schema.groomerBusinesses.name,
          plan: schema.groomerBusinesses.plan,
          createdAt: schema.groomerBusinesses.createdAt,
          ownerEmail: schema.users.email,
        })
        .from(schema.groomerBusinesses)
        .leftJoin(
          schema.users,
          eq(schema.groomerBusinesses.ownerUserId, schema.users.id),
        )
        .orderBy(desc(schema.groomerBusinesses.createdAt))
        .limit(10),
      this.db
        .select({
          id: schema.appointments.id,
          startTime: schema.appointments.startTime,
          status: schema.appointments.status,
          locationType: schema.appointments.locationType,
          businessName: schema.groomerBusinesses.name,
          clientEmail: schema.users.email,
        })
        .from(schema.appointments)
        .leftJoin(
          schema.groomerBusinesses,
          eq(schema.appointments.businessId, schema.groomerBusinesses.id),
        )
        .leftJoin(schema.users, eq(schema.appointments.clientId, schema.users.id))
        .orderBy(desc(schema.appointments.startTime))
        .limit(10),
    ]);

    return {
      totals: {
        users: usersTotal,
        businesses: businessesTotal,
        pets: petsTotal,
        services: servicesTotal,
        appointments: appointmentsTotal,
      },
      usersByRole: this.mapCountRows(usersByRoleRows, "role"),
      businessesByPlan: this.mapCountRows(businessesByPlanRows, "plan"),
      appointmentsByStatus: this.mapCountRows(appointmentsByStatusRows, "status"),
      appointmentsToday: Number(todayAppointments[0]?.count ?? 0),
      appointmentsNext7Days: Number(nextWeekAppointments[0]?.count ?? 0),
      recentUsers,
      recentBusinesses,
      recentAppointments,
    };
  }

  async getUsers(role?: UserRole) {
    const baseSelect = this.db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        role: schema.users.role,
        createdAt: schema.users.createdAt,
      })
      .from(schema.users)
      .orderBy(desc(schema.users.createdAt))
      .limit(100);

    const users = role
      ? await baseSelect.where(eq(schema.users.role, role))
      : await baseSelect;
    return { users };
  }

  private async countAll(table: AnyPgTable) {
    const rows = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(table);
    return Number(rows[0]?.count ?? 0);
  }

  private mapCountRows<T extends Record<string, unknown>>(
    rows: T[],
    key: keyof T,
  ) {
    const result: Record<string, number> = {};
    for (const row of rows) {
      const label = String(row[key]);
      const count = Number(
        (row as unknown as { count?: number | string }).count ?? 0,
      );
      result[label] = count;
    }
    return result;
  }
}
