import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, inArray, lt } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE_DB } from '../db/db.module';
import * as schema from '../db/schema';
import { hasOverlap } from '../shared/overlap';

type NewAppointment = typeof schema.appointments.$inferInsert;
type AppointmentItem = {
  petId: string;
  serviceId: string;
  calculatedDurationMinutes: number;
  extras?: unknown;
};

@Injectable()
export class AppointmentRepository {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findById(id: string) {
    const [appt] = await this.db
      .select()
      .from(schema.appointments)
      .where(eq(schema.appointments.id, id));
    return appt ?? null;
  }

  async findByClientId(clientId: string, limit = 100, offset = 0) {
    return this.db
      .select()
      .from(schema.appointments)
      .where(eq(schema.appointments.clientId, clientId))
      .limit(limit)
      .offset(offset);
  }

  async findByBusinessId(businessId: string, limit = 100, offset = 0) {
    return this.db
      .select()
      .from(schema.appointments)
      .where(eq(schema.appointments.businessId, businessId))
      .limit(limit)
      .offset(offset);
  }

  async findByGroomerId(groomerId: string, limit = 100, offset = 0) {
    return this.db
      .select()
      .from(schema.appointments)
      .where(eq(schema.appointments.groomerId, groomerId))
      .limit(limit)
      .offset(offset);
  }

  async findOverlapping(
    businessId: string,
    groomerId: string,
    startTime: Date,
    endTime: Date,
  ) {
    return this.db
      .select({
        id: schema.appointments.id,
        status: schema.appointments.status,
        startTime: schema.appointments.startTime,
        endTime: schema.appointments.endTime,
      })
      .from(schema.appointments)
      .where(
        and(
          eq(schema.appointments.businessId, businessId),
          eq(schema.appointments.groomerId, groomerId),
          lt(schema.appointments.startTime, endTime),
          gt(schema.appointments.endTime, startTime),
        ),
      );
  }

  // Atomic create with overlap check inside the same transaction — fixes race condition
  async create(
    data: Omit<NewAppointment, 'id' | 'createdAt' | 'updatedAt'>,
    items: AppointmentItem[],
  ) {
    return this.db.transaction(async (tx) => {
      // Re-check overlap inside transaction
      const overlapping = await tx
        .select({
          id: schema.appointments.id,
          status: schema.appointments.status,
          startTime: schema.appointments.startTime,
          endTime: schema.appointments.endTime,
        })
        .from(schema.appointments)
        .where(
          and(
            eq(schema.appointments.businessId, data.businessId),
            eq(schema.appointments.groomerId, data.groomerId!),
            lt(schema.appointments.startTime, data.endTime),
            gt(schema.appointments.endTime, data.startTime),
          ),
        );

      if (hasOverlap(overlapping, data.startTime, data.endTime)) {
        throw new Error('OVERLAP');
      }

      const [appointment] = await tx
        .insert(schema.appointments)
        .values(data)
        .returning();

      if (items.length > 0) {
        await tx.insert(schema.appointmentPets).values(
          items.map((item) => ({
            appointmentId: appointment.id,
            petId: item.petId,
            serviceId: item.serviceId,
            calculatedDurationMinutes: item.calculatedDurationMinutes,
            extras: item.extras ?? null,
          })),
        );
      }

      return appointment;
    });
  }

  async update(
    id: string,
    data: Partial<Omit<NewAppointment, 'id' | 'createdAt'>>,
  ) {
    const [appt] = await this.db
      .update(schema.appointments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.appointments.id, id))
      .returning();
    return appt;
  }

  async findWithDetails(ids: string[]) {
    if (ids.length === 0) return [];

    const rows = await this.db
      .select({
        appointment: schema.appointments,
        appointmentPet: schema.appointmentPets,
        pet: schema.pets,
        service: schema.services,
        client: schema.users,
        business: schema.groomerBusinesses,
      })
      .from(schema.appointments)
      .leftJoin(schema.users, eq(schema.users.id, schema.appointments.clientId))
      .leftJoin(
        schema.groomerBusinesses,
        eq(schema.groomerBusinesses.id, schema.appointments.businessId),
      )
      .leftJoin(
        schema.appointmentPets,
        eq(schema.appointmentPets.appointmentId, schema.appointments.id),
      )
      .leftJoin(schema.pets, eq(schema.pets.id, schema.appointmentPets.petId))
      .leftJoin(
        schema.services,
        eq(schema.services.id, schema.appointmentPets.serviceId),
      )
      .where(inArray(schema.appointments.id, ids));

    return this.groupAppointmentRows(rows);
  }

  async findWithDetailsById(id: string) {
    const results = await this.findWithDetails([id]);
    return results[0] ?? null;
  }

  private groupAppointmentRows(
    rows: {
      appointment: typeof schema.appointments.$inferSelect;
      appointmentPet: typeof schema.appointmentPets.$inferSelect | null;
      pet: typeof schema.pets.$inferSelect | null;
      service: typeof schema.services.$inferSelect | null;
      client: typeof schema.users.$inferSelect | null;
      business: typeof schema.groomerBusinesses.$inferSelect | null;
    }[],
  ) {
    type GroupedEntry = typeof schema.appointments.$inferSelect & {
      client: { id: string; email: string; role: string } | null;
      business: {
        id: string;
        name: string;
        phone: string;
        email: string | null;
        minHoursBeforeCancelOrReschedule: number;
      } | null;
      items: Array<{
        appointmentPet: typeof schema.appointmentPets.$inferSelect;
        pet: typeof schema.pets.$inferSelect | null;
        service: typeof schema.services.$inferSelect | null;
      }>;
    };

    const grouped = new Map<string, GroupedEntry>();

    for (const row of rows) {
      const appt = row.appointment;
      if (!grouped.has(appt.id)) {
        grouped.set(appt.id, {
          ...appt,
          client: null,
          business: null,
          items: [],
        });
      }
      const current = grouped.get(appt.id)!;

      if (row.client && !current.client) {
        current.client = {
          id: row.client.id,
          email: row.client.email,
          role: row.client.role,
        };
      }
      if (row.business && !current.business) {
        current.business = {
          id: row.business.id,
          name: row.business.name,
          phone: row.business.phone,
          email: row.business.email,
          minHoursBeforeCancelOrReschedule:
            row.business.minHoursBeforeCancelOrReschedule,
        };
      }
      if (row.appointmentPet) {
        current.items.push({
          appointmentPet: row.appointmentPet,
          pet: row.pet ?? null,
          service: row.service ?? null,
        });
      }
    }

    return Array.from(grouped.values());
  }
}
