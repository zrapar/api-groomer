import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { eq, and, inArray } from 'drizzle-orm';
import { hash } from 'bcrypt';
import * as schema from './schema';
import { UserRole } from '../auth/dto/user-role.enum';
import { resolveDurationMinutes } from '../shared/duration';

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

type BusinessSeed = {
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
};

type ClientSeed = {
  email: string;
  pets: Array<{
    species: 'DOG' | 'CAT';
    name: string;
    breed: string;
    size: 'MINI' | 'SMALL' | 'MEDIUM' | 'LARGE' | 'GIANT';
    coatType: 'SHORT' | 'MEDIUM' | 'LONG' | 'DENSE' | 'CURLY';
    notes?: string;
  }>;
};

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined,
  });
  const db = drizzle(pool, { schema });

  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'root@groomer.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || DEFAULT_PASSWORD;
  const seedDemoData =
    (process.env.SEED_DEMO_DATA || 'true').toLowerCase() === 'true';
  const seedReset =
    (process.env.SEED_RESET || 'false').toLowerCase() === 'true';
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
    const storeSeeds: BusinessSeed[] = [
      {
        slug: 'peluqueria-central',
        name: 'Peluqueria Central',
        description: 'Tienda principal con varios groomers',
        logoUrl: 'https://placehold.co/200x200?text=Central',
        coverImageUrl: 'https://placehold.co/1200x400?text=Peluqueria+Central',
        plan: 'PRO',
        phone: '+1 555 101 000',
        email: 'central@groomer.local',
        address: 'Avenida Central 101',
        offersInSalon: true,
        offersAtHome: true,
        maxDogsPerHomeVisit: 2,
        homeVisitSetupMinutes: 10,
        homeVisitTeardownMinutes: 10,
        defaultTransportMinutes: 15,
        minHoursBeforeCancelOrReschedule: 24,
      },
      {
        slug: 'pet-lab',
        name: 'Pet Lab',
        description: 'Sucursal urbana para perros y gatos',
        logoUrl: 'https://placehold.co/200x200?text=Pet+Lab',
        coverImageUrl: 'https://placehold.co/1200x400?text=Pet+Lab',
        plan: 'PRO',
        phone: '+1 555 202 000',
        email: 'petlab@groomer.local',
        address: 'Calle Norte 202',
        offersInSalon: true,
        offersAtHome: false,
        maxDogsPerHomeVisit: 0,
        homeVisitSetupMinutes: 0,
        homeVisitTeardownMinutes: 0,
        defaultTransportMinutes: 0,
        minHoursBeforeCancelOrReschedule: 12,
      },
      {
        slug: 'paws-club',
        name: 'Paws Club',
        description: 'Experiencia premium para mascotas',
        logoUrl: 'https://placehold.co/200x200?text=Paws',
        coverImageUrl: 'https://placehold.co/1200x400?text=Paws+Club',
        plan: 'PRO',
        phone: '+1 555 303 000',
        email: 'paws@groomer.local',
        address: 'Boulevard Sur 303',
        offersInSalon: true,
        offersAtHome: true,
        maxDogsPerHomeVisit: 3,
        homeVisitSetupMinutes: 12,
        homeVisitTeardownMinutes: 12,
        defaultTransportMinutes: 20,
        minHoursBeforeCancelOrReschedule: 24,
      },
      {
        slug: 'urban-pet',
        name: 'Urban Pet',
        description: 'Tienda con enfoque express',
        logoUrl: 'https://placehold.co/200x200?text=Urban',
        coverImageUrl: 'https://placehold.co/1200x400?text=Urban+Pet',
        plan: 'PRO',
        phone: '+1 555 404 000',
        email: 'urban@groomer.local',
        address: 'Calle Oeste 404',
        offersInSalon: true,
        offersAtHome: false,
        maxDogsPerHomeVisit: 0,
        homeVisitSetupMinutes: 0,
        homeVisitTeardownMinutes: 0,
        defaultTransportMinutes: 0,
        minHoursBeforeCancelOrReschedule: 8,
      },
      {
        slug: 'tienda-doggo',
        name: 'Tienda Doggo',
        description: 'Cadena local de grooming',
        logoUrl: 'https://placehold.co/200x200?text=Doggo',
        coverImageUrl: 'https://placehold.co/1200x400?text=Tienda+Doggo',
        plan: 'PRO',
        phone: '+1 555 505 000',
        email: 'doggo@groomer.local',
        address: 'Avenida Este 505',
        offersInSalon: true,
        offersAtHome: true,
        maxDogsPerHomeVisit: 2,
        homeVisitSetupMinutes: 8,
        homeVisitTeardownMinutes: 8,
        defaultTransportMinutes: 10,
        minHoursBeforeCancelOrReschedule: 12,
      },
    ];

    const independentSeeds: BusinessSeed[] = [
      {
        slug: 'groomer-luna',
        name: 'Groomer Luna',
        description: 'Independiente con servicio a domicilio',
        logoUrl: 'https://placehold.co/200x200?text=Luna',
        coverImageUrl: 'https://placehold.co/1200x400?text=Groomer+Luna',
        plan: 'FREE',
        phone: '+1 555 111 111',
        email: 'luna@groomer.local',
        address: 'Zona Norte 11',
        offersInSalon: false,
        offersAtHome: true,
        maxDogsPerHomeVisit: 1,
        homeVisitSetupMinutes: 8,
        homeVisitTeardownMinutes: 8,
        defaultTransportMinutes: 20,
        minHoursBeforeCancelOrReschedule: 24,
      },
      {
        slug: 'groomer-max',
        name: 'Groomer Max',
        description: 'Groomer movil con citas planificadas',
        logoUrl: 'https://placehold.co/200x200?text=Max',
        coverImageUrl: 'https://placehold.co/1200x400?text=Groomer+Max',
        plan: 'FREE',
        phone: '+1 555 222 222',
        email: 'max@groomer.local',
        address: 'Zona Sur 22',
        offersInSalon: false,
        offersAtHome: true,
        maxDogsPerHomeVisit: 2,
        homeVisitSetupMinutes: 10,
        homeVisitTeardownMinutes: 10,
        defaultTransportMinutes: 15,
        minHoursBeforeCancelOrReschedule: 12,
      },
      {
        slug: 'groomer-ana',
        name: 'Groomer Ana',
        description: 'Atencion personalizada en salon',
        logoUrl: 'https://placehold.co/200x200?text=Ana',
        coverImageUrl: 'https://placehold.co/1200x400?text=Groomer+Ana',
        plan: 'FREE',
        phone: '+1 555 333 333',
        email: 'ana@groomer.local',
        address: 'Zona Centro 33',
        offersInSalon: true,
        offersAtHome: false,
        maxDogsPerHomeVisit: 0,
        homeVisitSetupMinutes: 0,
        homeVisitTeardownMinutes: 0,
        defaultTransportMinutes: 0,
        minHoursBeforeCancelOrReschedule: 12,
      },
      {
        slug: 'groomer-toby',
        name: 'Groomer Toby',
        description: 'Servicios combinados salon y domicilio',
        logoUrl: 'https://placehold.co/200x200?text=Toby',
        coverImageUrl: 'https://placehold.co/1200x400?text=Groomer+Toby',
        plan: 'FREE',
        phone: '+1 555 444 444',
        email: 'toby@groomer.local',
        address: 'Zona Lago 44',
        offersInSalon: true,
        offersAtHome: true,
        maxDogsPerHomeVisit: 2,
        homeVisitSetupMinutes: 8,
        homeVisitTeardownMinutes: 8,
        defaultTransportMinutes: 15,
        minHoursBeforeCancelOrReschedule: 24,
      },
      {
        slug: 'groomer-sofi',
        name: 'Groomer Sofi',
        description: 'Groomer independiente de gatos',
        logoUrl: 'https://placehold.co/200x200?text=Sofi',
        coverImageUrl: 'https://placehold.co/1200x400?text=Groomer+Sofi',
        plan: 'FREE',
        phone: '+1 555 555 555',
        email: 'sofi@groomer.local',
        address: 'Zona Este 55',
        offersInSalon: true,
        offersAtHome: false,
        maxDogsPerHomeVisit: 0,
        homeVisitSetupMinutes: 0,
        homeVisitTeardownMinutes: 0,
        defaultTransportMinutes: 0,
        minHoursBeforeCancelOrReschedule: 12,
      },
    ];

    const clientSeeds: ClientSeed[] = [
      {
        email: 'cliente1@groomer.local',
        pets: [
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
        ],
      },
      {
        email: 'cliente2@groomer.local',
        pets: [
          {
            species: 'DOG',
            name: 'Rocky',
            breed: 'Bulldog',
            size: 'MEDIUM',
            coatType: 'SHORT',
            notes: 'Le gusta el agua tibia',
          },
          {
            species: 'DOG',
            name: 'Nala',
            breed: 'Beagle',
            size: 'SMALL',
            coatType: 'SHORT',
          },
        ],
      },
      {
        email: 'cliente3@groomer.local',
        pets: [
          {
            species: 'CAT',
            name: 'Kira',
            breed: 'Siames',
            size: 'SMALL',
            coatType: 'SHORT',
          },
          {
            species: 'DOG',
            name: 'Bruno',
            breed: 'Golden',
            size: 'LARGE',
            coatType: 'LONG',
          },
        ],
      },
      {
        email: 'cliente4@groomer.local',
        pets: [
          {
            species: 'DOG',
            name: 'Toby',
            breed: 'Schnauzer',
            size: 'MEDIUM',
            coatType: 'DENSE',
          },
          {
            species: 'CAT',
            name: 'Lola',
            breed: 'Angora',
            size: 'SMALL',
            coatType: 'LONG',
          },
        ],
      },
      {
        email: 'cliente5@groomer.local',
        pets: [
          {
            species: 'DOG',
            name: 'Simba',
            breed: 'Labrador',
            size: 'LARGE',
            coatType: 'SHORT',
          },
          {
            species: 'CAT',
            name: 'Mia',
            breed: 'Mestizo',
            size: 'SMALL',
            coatType: 'MEDIUM',
          },
        ],
      },
    ];

    await seedBusinesses({
      db,
      stores: storeSeeds,
      independents: independentSeeds,
      createdAccounts,
      seedForcePasswords,
    });

    await seedClients({
      db,
      clients: clientSeeds,
      createdAccounts,
      seedForcePasswords,
    });

    await seedAppointments(db);
  }

  // keep linter happy
  void admin;

  await pool.end();
  console.log(
    `Seed complete. Demo data: ${seedDemoData ? 'enabled' : 'disabled'}`,
  );
  logSeedAccounts(createdAccounts);
}

async function seedBusinesses(params: {
  db: ReturnType<typeof drizzle>;
  stores: BusinessSeed[];
  independents: BusinessSeed[];
  createdAccounts: SeedAccountResult[];
  seedForcePasswords: boolean;
}) {
  for (const [index, seed] of params.stores.entries()) {
    const password = generatePassword();
    const email = `store${index + 1}@groomer.local`;
    const owner = await upsertUser(
      params.db,
      email,
      password,
      UserRole.GROOMER_OWNER,
      params.seedForcePasswords,
    );
    params.createdAccounts.push({
      email: owner.user.email,
      role: UserRole.GROOMER_OWNER,
      password: owner.password,
      created: owner.created,
    });

    const business = await upsertBusiness(params.db, owner.user.id, seed);
    await upsertWorkingHours(params.db, business.id);
    const services = await upsertServices(
      params.db,
      business.id,
      buildServicesForBusiness(seed.offersAtHome),
    );
    await upsertDurationRules(params.db, services);
    await seedStoreStaff(
      params.db,
      business.id,
      index + 1,
      params.createdAccounts,
      params.seedForcePasswords,
    );
  }

  for (const [index, seed] of params.independents.entries()) {
    const password = generatePassword();
    const email = `groomer${index + 1}@groomer.local`;
    const owner = await upsertUser(
      params.db,
      email,
      password,
      UserRole.GROOMER_OWNER,
      params.seedForcePasswords,
    );
    params.createdAccounts.push({
      email: owner.user.email,
      role: UserRole.GROOMER_OWNER,
      password: owner.password,
      created: owner.created,
    });

    const business = await upsertBusiness(params.db, owner.user.id, seed);
    await upsertWorkingHours(params.db, business.id);
    const services = await upsertServices(
      params.db,
      business.id,
      buildServicesForBusiness(seed.offersAtHome),
    );
    await upsertDurationRules(params.db, services);
    await seedIndependentStaff(
      params.db,
      business.id,
      index + 1,
      params.createdAccounts,
      params.seedForcePasswords,
    );
  }
}

async function seedClients(params: {
  db: ReturnType<typeof drizzle>;
  clients: ClientSeed[];
  createdAccounts: SeedAccountResult[];
  seedForcePasswords: boolean;
}) {
  for (const clientSeed of params.clients) {
    const password = generatePassword();
    const client = await upsertUser(
      params.db,
      clientSeed.email,
      password,
      UserRole.CLIENT,
      params.seedForcePasswords,
    );
    params.createdAccounts.push({
      email: client.user.email,
      role: UserRole.CLIENT,
      password: client.password,
      created: client.created,
    });

    await upsertPets(params.db, client.user.id, clientSeed.pets);
  }
}

async function seedStoreStaff(
  db: ReturnType<typeof drizzle>,
  businessId: string,
  storeIndex: number,
  createdAccounts: SeedAccountResult[],
  seedForcePasswords: boolean,
) {
  for (let i = 1; i <= 2; i += 1) {
    const password = generatePassword();
    const email = `store${storeIndex}.staff${i}@groomer.local`;
    const staff = await upsertUser(
      db,
      email,
      password,
      UserRole.GROOMER_STAFF,
      seedForcePasswords,
    );
    createdAccounts.push({
      email: staff.user.email,
      role: UserRole.GROOMER_STAFF,
      password: staff.password,
      created: staff.created,
    });
    await upsertStaffMember(
      db,
      businessId,
      staff.user.id,
      `Staff ${i} Store ${storeIndex}`,
    );
  }
}

async function seedIndependentStaff(
  db: ReturnType<typeof drizzle>,
  businessId: string,
  ownerIndex: number,
  createdAccounts: SeedAccountResult[],
  seedForcePasswords: boolean,
) {
  const password = generatePassword();
  const email = `groomer${ownerIndex}.staff1@groomer.local`;
  const staff = await upsertUser(
    db,
    email,
    password,
    UserRole.GROOMER_STAFF,
    seedForcePasswords,
  );
  createdAccounts.push({
    email: staff.user.email,
    role: UserRole.GROOMER_STAFF,
    password: staff.password,
    created: staff.created,
  });
  await upsertStaffMember(
    db,
    businessId,
    staff.user.id,
    `Staff 1 Groomer ${ownerIndex}`,
  );
}

async function seedAppointments(db: ReturnType<typeof drizzle>) {
  const existing = await db
    .select({ id: schema.appointments.id })
    .from(schema.appointments)
    .limit(1);
  if (existing.length > 0) {
    return;
  }

  const businesses = await db.select().from(schema.groomerBusinesses).limit(5);

  const clients = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.role, UserRole.CLIENT));

  if (businesses.length === 0 || clients.length === 0) {
    return;
  }

  const pets = await db
    .select()
    .from(schema.pets)
    .where(
      inArray(
        schema.pets.ownerUserId,
        clients.map((c) => c.id),
      ),
    );

  const services = await db.select().from(schema.services);
  const rules = await db.select().from(schema.serviceDurationRules);

  const servicesByBusiness = services.reduce<Record<string, typeof services>>(
    (acc, service) => {
      acc[service.businessId] = acc[service.businessId] || [];
      acc[service.businessId].push(service);
      return acc;
    },
    {},
  );

  const rulesByService = rules.reduce<Record<string, typeof rules>>(
    (acc, rule) => {
      acc[rule.serviceId] = acc[rule.serviceId] || [];
      acc[rule.serviceId].push(rule);
      return acc;
    },
    {},
  );

  const petsByOwner = pets.reduce<Record<string, typeof pets>>((acc, pet) => {
    acc[pet.ownerUserId] = acc[pet.ownerUserId] || [];
    acc[pet.ownerUserId].push(pet);
    return acc;
  }, {});

  const baseDate = new Date();
  baseDate.setHours(10, 0, 0, 0);

  const statuses: Array<(typeof schema.appointments.$inferInsert)['status']> = [
    'PENDING',
    'CONFIRMED',
    'IN_PROGRESS',
    'DONE',
    'CANCELLED',
    'NO_SHOW',
  ];
  let dayOffset = 1;
  for (const business of businesses) {
    const businessServices = servicesByBusiness[business.id] || [];
    if (businessServices.length === 0) {
      continue;
    }

    const client = clients[dayOffset % clients.length];
    const clientPets = petsByOwner[client.id] || [];
    if (clientPets.length === 0) {
      continue;
    }

    const locationType =
      business.offersAtHome && dayOffset % 2 === 0 ? 'AT_HOME' : 'IN_SALON';

    const items = clientPets.slice(0, locationType === 'AT_HOME' ? 2 : 1);
    const appointmentItems = items
      .map((pet) => {
        const service = businessServices.find(
          (entry) =>
            entry.locationsSupported.includes(locationType) &&
            entry.speciesSupported.includes(pet.species),
        );
        if (!service) {
          return null;
        }
        const serviceRules = rulesByService[service.id] || [];
        const duration = resolveDurationMinutes(serviceRules, {
          species: pet.species,
          size: pet.size,
          breed: pet.breed,
        });
        return { pet, service, duration };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    if (appointmentItems.length === 0) {
      continue;
    }

    const totalMinutes = appointmentItems.reduce(
      (sum, item) => sum + item.duration,
      0,
    );
    const extraMinutes =
      locationType === 'AT_HOME'
        ? business.homeVisitSetupMinutes +
          business.homeVisitTeardownMinutes +
          business.defaultTransportMinutes
        : 0;
    const start = new Date(baseDate);
    start.setDate(start.getDate() + dayOffset);
    start.setHours(10 + (dayOffset % 3) * 3, 0, 0, 0);
    const end = new Date(
      start.getTime() + (totalMinutes + extraMinutes) * 60000,
    );

    const status = statuses[dayOffset % statuses.length];
    const [appointment] = await db
      .insert(schema.appointments)
      .values({
        businessId: business.id,
        clientId: client.id,
        groomerId: business.ownerUserId,
        locationType,
        startTime: start,
        endTime: end,
        status,
        cancelReason:
          status === 'CANCELLED'
            ? 'Cliente canceló'
            : status === 'NO_SHOW'
              ? 'Cliente no asistió'
              : null,
      })
      .returning();

    await db.insert(schema.appointmentPets).values(
      appointmentItems.map((item) => ({
        appointmentId: appointment.id,
        petId: item.pet.id,
        serviceId: item.service.id,
        calculatedDurationMinutes: item.duration,
        extras: null,
      })),
    );

    dayOffset += 1;
  }
}

function buildServicesForBusiness(offersAtHome: boolean) {
  const locations = offersAtHome ? ['IN_SALON', 'AT_HOME'] : ['IN_SALON'];
  const services = [
    {
      name: 'Baño premium',
      description: 'Baño completo con secado',
      speciesSupported: ['DOG', 'CAT'],
      locationsSupported: locations,
    },
    {
      name: 'Corte y estilo',
      description: 'Corte estetico para perros',
      speciesSupported: ['DOG'],
      locationsSupported: ['IN_SALON'],
    },
  ];

  if (offersAtHome) {
    services.push({
      name: 'Servicio domicilio',
      description: 'Servicio completo en casa del cliente',
      speciesSupported: ['DOG', 'CAT'],
      locationsSupported: ['AT_HOME'],
    });
  }

  return services;
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
  details: BusinessSeed,
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
      minHoursBeforeCancelOrReschedule:
        details.minHoursBeforeCancelOrReschedule,
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
            description: 'Corte estetico',
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
  if (services.length === 0) {
    return;
  }

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
    console.log(`- ${account.email} | ${account.role} | password: ${password}`);
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
