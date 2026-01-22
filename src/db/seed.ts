import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { eq, and } from 'drizzle-orm';
import { hash } from 'bcrypt';
import * as schema from './schema';
import { UserRole } from '../auth/dto/user-role.enum';

const DEFAULT_PASSWORD = '123123Testing$.';

type SeedAccountResult = {
  email: string;
  role: UserRole;
  password: string | null;
  created: boolean;
};

type UpsertUserResult = {
  user: typeof schema.users.$inferSelect;
  created: boolean;
  password: string | null;
};

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
  const seedReset = (process.env.SEED_RESET || 'false').toLowerCase() === 'true';
  const seedForcePasswords =
    (process.env.SEED_FORCE_PASSWORDS || 'false').toLowerCase() === 'true';

  if (seedReset) {
    await resetDatabase(db);
  }

  const createdAccounts: SeedAccountResult[] = [];
  const admin = await upsertUser(
    db,
    adminEmail,
    adminPassword,
    UserRole.ADMIN,
    seedForcePasswords,
  );
  createdAccounts.push({
    email: admin.user.email,
    role: UserRole.ADMIN,
    password: admin.password,
    created: admin.created,
  });
  if (seedDemoData) {
    const groomerOwner1 = await upsertUser(
      db,
      groomerEmail,
      groomerPassword,
      UserRole.GROOMER_OWNER,
      seedForcePasswords,
    );
    const owner2Password = generatePassword();
    const groomerOwner2 = await upsertUser(
      db,
      'owner2@groomer.local',
      owner2Password,
      UserRole.GROOMER_OWNER,
      seedForcePasswords,
    );
    const client1 = await upsertUser(
      db,
      clientEmail,
      clientPassword,
      UserRole.CLIENT,
      seedForcePasswords,
    );
    const client2Password = generatePassword();
    const client2 = await upsertUser(
      db,
      'client2@groomer.local',
      client2Password,
      UserRole.CLIENT,
      seedForcePasswords,
    );

    const staff1Password = generatePassword();
    const staff1 = await upsertUser(
      db,
      'staff1@groomer.local',
      staff1Password,
      UserRole.GROOMER_STAFF,
      seedForcePasswords,
    );
    const staff2Password = generatePassword();
    const staff2 = await upsertUser(
      db,
      'staff2@groomer.local',
      staff2Password,
      UserRole.GROOMER_STAFF,
      seedForcePasswords,
    );

    createdAccounts.push(
      { email: groomerOwner1.user.email, role: UserRole.GROOMER_OWNER, password: groomerOwner1.password, created: groomerOwner1.created },
      { email: groomerOwner2.user.email, role: UserRole.GROOMER_OWNER, password: groomerOwner2.password, created: groomerOwner2.created },
      { email: client1.user.email, role: UserRole.CLIENT, password: client1.password, created: client1.created },
      { email: client2.user.email, role: UserRole.CLIENT, password: client2.password, created: client2.created },
      { email: staff1.user.email, role: UserRole.GROOMER_STAFF, password: staff1.password, created: staff1.created },
      { email: staff2.user.email, role: UserRole.GROOMER_STAFF, password: staff2.password, created: staff2.created },
    );

    const business1 = await upsertBusiness(db, groomerOwner1.user.id, {
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
    });

    const business2 = await upsertBusiness(db, groomerOwner2.user.id, {
      slug: 'pet-lab',
      name: 'Pet Lab',
      description: 'Tienda con varios groomers',
      logoUrl: 'https://placehold.co/200x200?text=Pet+Lab',
      coverImageUrl: 'https://placehold.co/1200x400?text=Pet+Lab',
      plan: 'PRO',
      phone: '+1 555 000 222',
      email: 'petlab@groomer.local',
      address: 'Avenida Central 456',
      offersInSalon: true,
      offersAtHome: false,
      maxDogsPerHomeVisit: 0,
      homeVisitSetupMinutes: 0,
      homeVisitTeardownMinutes: 0,
      defaultTransportMinutes: 0,
      minHoursBeforeCancelOrReschedule: 12,
    });

    await upsertWorkingHours(db, business1.id);
    await upsertWorkingHours(db, business2.id);

    const services1 = await upsertServices(db, business1.id);
    const services2 = await upsertServices(db, business2.id, [
      {
        name: 'Spa completo',
        description: 'Incluye baño, secado y perfume',
        speciesSupported: ['DOG', 'CAT'],
        locationsSupported: ['IN_SALON'],
      },
      {
        name: 'Corte express',
        description: 'Corte rapido para perros',
        speciesSupported: ['DOG'],
        locationsSupported: ['IN_SALON'],
      },
    ]);
    await upsertDurationRules(db, services1);
    await upsertDurationRules(db, services2);

    await upsertStaffMember(db, business2.id, staff1.user.id, 'Diana Groomer');
    await upsertStaffMember(db, business2.id, staff2.user.id, 'Marco Groomer');

    await upsertPets(db, client1.user.id);
    await upsertPets(db, client2.user.id, [
      {
        species: 'DOG',
        name: 'Rocky',
        breed: 'Bulldog',
        size: 'MEDIUM',
        coatType: 'SHORT',
        notes: 'Le gusta el agua tibia',
      },
    ]);
  }

  // keep linter happy
  void admin;

  await pool.end();
  console.log(
    `Seed complete. Demo data: ${seedDemoData ? 'enabled' : 'disabled'}`,
  );
  logSeedAccounts(createdAccounts);
}

async function upsertUser(
  db: ReturnType<typeof drizzle>,
  email: string,
  password: string,
  role: UserRole,
  forcePassword: boolean,
): Promise<UpsertUserResult> {
  const existing = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email));

  if (existing[0]) {
    if (forcePassword) {
      const passwordHash = await hash(password, 10);
      const [updated] = await db
        .update(schema.users)
        .set({ passwordHash })
        .where(eq(schema.users.id, existing[0].id))
        .returning();
      return { user: updated, created: false, password };
    }
    return { user: existing[0], created: false, password: null };
  }

  const passwordHash = await hash(password, 10);
  const [created] = await db
    .insert(schema.users)
    .values({ email, passwordHash, role })
    .returning();

  return { user: created, created: true, password };
}

async function upsertBusiness(
  db: ReturnType<typeof drizzle>,
  ownerUserId: string,
  details: {
    slug: string;
    name: string;
    description?: string;
    logoUrl?: string;
    coverImageUrl?: string;
    plan: 'FREE' | 'PRO';
    phone: string;
    email?: string;
    address: string;
    offersInSalon: boolean;
    offersAtHome: boolean;
    maxDogsPerHomeVisit: number;
    homeVisitSetupMinutes: number;
    homeVisitTeardownMinutes: number;
    defaultTransportMinutes: number;
    minHoursBeforeCancelOrReschedule: number;
  },
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
      slug: details.slug,
      name: details.name,
      description: details.description,
      logoUrl: details.logoUrl,
      coverImageUrl: details.coverImageUrl,
      plan: details.plan,
      phone: details.phone,
      email: details.email,
      address: details.address,
      offersInSalon: details.offersInSalon,
      offersAtHome: details.offersAtHome,
      maxDogsPerHomeVisit: details.maxDogsPerHomeVisit,
      homeVisitSetupMinutes: details.homeVisitSetupMinutes,
      homeVisitTeardownMinutes: details.homeVisitTeardownMinutes,
      defaultTransportMinutes: details.defaultTransportMinutes,
      minHoursBeforeCancelOrReschedule: details.minHoursBeforeCancelOrReschedule,
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
  customServices?: Array<{
    name: string;
    description: string;
    speciesSupported: string[];
    locationsSupported: string[];
  }>,
) {
  const existing = await db
    .select()
    .from(schema.services)
    .where(eq(schema.services.businessId, businessId));

  if (existing.length > 0) {
    return existing;
  }

  const baseServices =
    customServices && customServices.length > 0
      ? customServices
      : [
          {
            name: 'Baño premium',
            description: 'Baño completo con secado',
            speciesSupported: ['DOG', 'CAT'],
            locationsSupported: ['IN_SALON', 'AT_HOME'],
          },
          {
            name: 'Corte y estilo',
            description: 'Corte con arreglo estético',
            speciesSupported: ['DOG'],
            locationsSupported: ['IN_SALON'],
          },
        ];

  const created = await db
    .insert(schema.services)
    .values(
      baseServices.map((service) => ({
        businessId,
        name: service.name,
        description: service.description,
        speciesSupported: service.speciesSupported,
        locationsSupported: service.locationsSupported,
        isActive: true,
      })),
    )
    .returning();

  return created;
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

async function upsertPets(
  db: ReturnType<typeof drizzle>,
  ownerUserId: string,
  pets?: Array<{
    species: 'DOG' | 'CAT';
    name: string;
    breed: string;
    size: 'MINI' | 'SMALL' | 'MEDIUM' | 'LARGE' | 'GIANT';
    coatType: 'SHORT' | 'MEDIUM' | 'LONG' | 'DENSE' | 'CURLY';
    notes?: string;
  }>,
) {
  const existing = await db
    .select()
    .from(schema.pets)
    .where(eq(schema.pets.ownerUserId, ownerUserId));

  if (existing.length > 0) {
    return;
  }

  const basePets =
    pets && pets.length > 0
      ? pets
      : [
          {
            species: 'DOG',
            name: 'Luna',
            breed: 'Poodle',
            size: 'SMALL',
            coatType: 'CURLY',
            notes: 'Primera visita',
          },
          {
            species: 'CAT',
            name: 'Milo',
            breed: 'Mestizo',
            size: 'SMALL',
            coatType: 'SHORT',
            notes: 'Prefiere agua tibia',
          },
        ];

  await db.insert(schema.pets).values(
    basePets.map((pet) => ({
      ownerUserId,
      species: pet.species,
      name: pet.name,
      breed: pet.breed,
      size: pet.size,
      coatType: pet.coatType,
      notes: pet.notes,
    })),
  );
}

async function upsertStaffMember(
  db: ReturnType<typeof drizzle>,
  businessId: string,
  userId: string,
  displayName: string,
) {
  const existing = await db
    .select()
    .from(schema.groomerStaffMembers)
    .where(
      and(
        eq(schema.groomerStaffMembers.businessId, businessId),
        eq(schema.groomerStaffMembers.userId, userId),
      ),
    );

  if (existing[0]) {
    return existing[0];
  }

  const [created] = await db
    .insert(schema.groomerStaffMembers)
    .values({
      businessId,
      userId,
      displayName,
      isActive: true,
    })
    .returning();

  return created;
}

function generatePassword() {
  return Math.random().toString(36).slice(2, 10) + 'A1!';
}

function logSeedAccounts(accounts: SeedAccountResult[]) {
  if (accounts.length === 0) {
    return;
  }
  console.log('Seeded accounts:');
  for (const account of accounts) {
    const password = account.password ?? '(existing)';
    console.log(
      `- ${account.email} | ${account.role} | password: ${password}`,
    );
  }
}

async function resetDatabase(db: ReturnType<typeof drizzle>) {
  await db.transaction(async (tx) => {
    await tx.delete(schema.appointmentPets);
    await tx.delete(schema.appointments);
    await tx.delete(schema.serviceDurationRules);
    await tx.delete(schema.services);
    await tx.delete(schema.businessWorkingHours);
    await tx.delete(schema.groomerStaffMembers);
    await tx.delete(schema.pets);
    await tx.delete(schema.groomerBusinesses);
    await tx.delete(schema.users);
  });
  console.log('Database reset completed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
