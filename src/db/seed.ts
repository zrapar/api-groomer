import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { eq, and } from 'drizzle-orm';
import { hash } from 'bcrypt';
import * as schema from './schema';
import { UserRole } from '../auth/dto/user-role.enum';

const DEFAULT_PASSWORD = '123123Testing$.';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool, { schema });

  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'root@groomer.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || DEFAULT_PASSWORD;
  const groomerEmail = process.env.SEED_GROOMER_EMAIL || 'owner@groomer.local';
  const groomerPassword = process.env.SEED_GROOMER_PASSWORD || DEFAULT_PASSWORD;
  const clientEmail = process.env.SEED_CLIENT_EMAIL || 'client@groomer.local';
  const clientPassword = process.env.SEED_CLIENT_PASSWORD || DEFAULT_PASSWORD;
  const seedDemoData =
    (process.env.SEED_DEMO_DATA || 'true').toLowerCase() === 'true';

  const admin = await upsertUser(db, adminEmail, adminPassword, UserRole.ADMIN);
  if (seedDemoData) {
    const groomer = await upsertUser(
      db,
      groomerEmail,
      groomerPassword,
      UserRole.GROOMER_OWNER,
    );
    const client = await upsertUser(
      db,
      clientEmail,
      clientPassword,
      UserRole.CLIENT,
    );

    const business = await upsertBusiness(db, groomer.id);
    await upsertWorkingHours(db, business.id);
    const services = await upsertServices(db, business.id);
    await upsertDurationRules(db, services);
    await upsertPets(db, client.id);
  }

  // keep linter happy
  void admin;

  await pool.end();
  console.log(
    `Seed complete. Demo data: ${seedDemoData ? 'enabled' : 'disabled'}`,
  );
}

async function upsertUser(
  db: ReturnType<typeof drizzle>,
  email: string,
  password: string,
  role: UserRole,
) {
  const existing = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email));

  if (existing[0]) {
    return existing[0];
  }

  const passwordHash = await hash(password, 10);
  const [created] = await db
    .insert(schema.users)
    .values({ email, passwordHash, role })
    .returning();

  return created;
}

async function upsertBusiness(
  db: ReturnType<typeof drizzle>,
  ownerUserId: string,
) {
  const existing = await db
    .select()
    .from(schema.groomerBusinesses)
    .where(eq(schema.groomerBusinesses.ownerUserId, ownerUserId));

  if (existing[0]) {
    return existing[0];
  }

  const [created] = await db
    .insert(schema.groomerBusinesses)
    .values({
      ownerUserId,
      slug: 'groomer-studio',
      name: 'Groomer Studio',
      description: 'Salon principal',
      logoUrl: 'https://placehold.co/200x200?text=Groomer',
      coverImageUrl: 'https://placehold.co/1200x400?text=Groomer+Studio',
      plan: 'PRO',
      phone: '+1 555 000 000',
      email: 'studio@groomer.local',
      address: 'Calle Principal 123',
      offersInSalon: true,
      offersAtHome: true,
      maxDogsPerHomeVisit: 2,
      homeVisitSetupMinutes: 10,
      homeVisitTeardownMinutes: 10,
      defaultTransportMinutes: 15,
      minHoursBeforeCancelOrReschedule: 24,
    })
    .returning();

  return created;
}

async function upsertWorkingHours(
  db: ReturnType<typeof drizzle>,
  businessId: string,
) {
  const existing = await db
    .select()
    .from(schema.businessWorkingHours)
    .where(eq(schema.businessWorkingHours.businessId, businessId));

  if (existing.length > 0) {
    return;
  }

  const weekdays = [1, 2, 3, 4, 5];
  await db.insert(schema.businessWorkingHours).values(
    weekdays.map((weekday) => ({
      businessId,
      weekday,
      startTime: '09:00',
      endTime: '18:00',
    })),
  );
}

async function upsertServices(
  db: ReturnType<typeof drizzle>,
  businessId: string,
) {
  const existing = await db
    .select()
    .from(schema.services)
    .where(eq(schema.services.businessId, businessId));

  if (existing.length > 0) {
    return existing;
  }

  const [basic] = await db
    .insert(schema.services)
    .values({
      businessId,
      name: 'Baño premium',
      description: 'Baño completo con secado',
      speciesSupported: ['DOG', 'CAT'],
      locationsSupported: ['IN_SALON', 'AT_HOME'],
      isActive: true,
    })
    .returning();

  const [full] = await db
    .insert(schema.services)
    .values({
      businessId,
      name: 'Corte y estilo',
      description: 'Corte con arreglo estético',
      speciesSupported: ['DOG'],
      locationsSupported: ['IN_SALON'],
      isActive: true,
    })
    .returning();

  return [basic, full];
}

async function upsertDurationRules(
  db: ReturnType<typeof drizzle>,
  services: Array<{ id: string }>,
) {
  const existing = await db
    .select()
    .from(schema.serviceDurationRules)
    .where(eq(schema.serviceDurationRules.serviceId, services[0].id));

  if (existing.length > 0) {
    return;
  }

  for (const service of services) {
    await db.insert(schema.serviceDurationRules).values([
      {
        serviceId: service.id,
        species: 'DOG',
        size: 'SMALL',
        baseDurationMinutes: 45,
        isDefaultForSpecies: false,
      },
      {
        serviceId: service.id,
        species: 'DOG',
        size: 'MEDIUM',
        baseDurationMinutes: 60,
        isDefaultForSpecies: false,
      },
      {
        serviceId: service.id,
        species: 'DOG',
        baseDurationMinutes: 50,
        isDefaultForSpecies: true,
      },
      {
        serviceId: service.id,
        species: 'CAT',
        baseDurationMinutes: 45,
        isDefaultForSpecies: true,
      },
    ]);
  }
}

async function upsertPets(db: ReturnType<typeof drizzle>, ownerUserId: string) {
  const existing = await db
    .select()
    .from(schema.pets)
    .where(eq(schema.pets.ownerUserId, ownerUserId));

  if (existing.length > 0) {
    return;
  }

  await db.insert(schema.pets).values([
    {
      ownerUserId,
      species: 'DOG',
      name: 'Luna',
      breed: 'Poodle',
      size: 'SMALL',
      coatType: 'CURLY',
      notes: 'Primera visita',
    },
    {
      ownerUserId,
      species: 'CAT',
      name: 'Milo',
      breed: 'Mestizo',
      size: 'SMALL',
      coatType: 'SHORT',
      notes: 'Prefiere agua tibia',
    },
  ]);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
