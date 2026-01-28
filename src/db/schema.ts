import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', [
  'GROOMER_OWNER',
  'GROOMER_STAFF',
  'CLIENT',
  'ADMIN',
]);

export const speciesEnum = pgEnum('species', ['DOG', 'CAT']);
export const petSizeEnum = pgEnum('pet_size', [
  'MINI',
  'SMALL',
  'MEDIUM',
  'LARGE',
  'GIANT',
]);
export const coatTypeEnum = pgEnum('coat_type', [
  'SHORT',
  'MEDIUM',
  'LONG',
  'DENSE',
  'CURLY',
]);

export const locationTypeEnum = pgEnum('location_type', [
  'IN_SALON',
  'AT_HOME',
]);

export const appointmentStatusEnum = pgEnum('appointment_status', [
  'PENDING',
  'CONFIRMED',
  'IN_PROGRESS',
  'DONE',
  'CANCELLED',
  'NO_SHOW',
]);

export const groomerPlanEnum = pgEnum('groomer_plan', ['FREE', 'PRO']);

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: userRoleEnum('role').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const groomerBusinesses = pgTable(
  'groomer_businesses',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    description: text('description'),
    logoUrl: text('logo_url'),
    coverImageUrl: text('cover_image_url'),
    plan: groomerPlanEnum('plan').notNull().default('FREE'),
    googleRefreshToken: text('google_refresh_token'),
    googleAccessToken: text('google_access_token'),
    googleTokenExpiry: timestamp('google_token_expiry', { withTimezone: true }),
    googleCalendarId: text('google_calendar_id'),
    googleAccountEmail: text('google_account_email'),
    phone: text('phone').notNull(),
    email: text('email'),
    address: text('address').notNull(),
    latitude: numeric('latitude', { precision: 9, scale: 6 }),
    longitude: numeric('longitude', { precision: 9, scale: 6 }),
    offersInSalon: boolean('offers_in_salon').notNull().default(true),
    offersAtHome: boolean('offers_at_home').notNull().default(false),
    maxDogsPerHomeVisit: integer('max_dogs_per_home_visit'),
    homeVisitSetupMinutes: integer('home_visit_setup_minutes')
      .notNull()
      .default(0),
    homeVisitTeardownMinutes: integer('home_visit_teardown_minutes')
      .notNull()
      .default(0),
    defaultTransportMinutes: integer('default_transport_minutes')
      .notNull()
      .default(0),
    minHoursBeforeCancelOrReschedule: integer(
      'min_hours_before_cancel_or_reschedule',
    )
      .notNull()
      .default(24),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    ownerUserIdIndex: index('groomer_business_owner_user_id_idx').on(
      table.ownerUserId,
    ),
    slugIndex: index('groomer_business_slug_idx').on(table.slug),
  }),
);

export const businessWorkingHours = pgTable(
  'business_working_hours',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => groomerBusinesses.id, { onDelete: 'cascade' }),
    weekday: integer('weekday').notNull(),
    startTime: text('start_time').notNull(),
    endTime: text('end_time').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    businessWeekdayIndex: index(
      'business_working_hours_business_weekday_idx',
    ).on(table.businessId, table.weekday),
  }),
);

export const pets = pgTable(
  'pets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    species: speciesEnum('species').notNull(),
    name: text('name').notNull(),
    breed: text('breed').notNull(),
    size: petSizeEnum('size').notNull(),
    coatType: coatTypeEnum('coat_type').notNull(),
    birthDate: timestamp('birth_date', { withTimezone: false }),
    weightKg: numeric('weight_kg', { precision: 5, scale: 2 }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    ownerUserIdIndex: index('pets_owner_user_id_idx').on(table.ownerUserId),
  }),
);

export const services = pgTable(
  'services',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => groomerBusinesses.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description').notNull(),
    speciesSupported: text('species_supported').array().notNull(),
    locationsSupported: text('locations_supported').array().notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    businessIdIndex: index('services_business_id_idx').on(table.businessId),
  }),
);

export const serviceDurationRules = pgTable(
  'service_duration_rules',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    serviceId: uuid('service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'cascade' }),
    species: speciesEnum('species').notNull(),
    size: petSizeEnum('size'),
    breed: text('breed'),
    baseDurationMinutes: integer('base_duration_minutes').notNull(),
    isDefaultForSpecies: boolean('is_default_for_species')
      .notNull()
      .default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    serviceSpeciesIndex: index('service_duration_rules_service_species_idx').on(
      table.serviceId,
      table.species,
    ),
  }),
);

export const groomerStaffMembers = pgTable(
  'groomer_staff_members',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => groomerBusinesses.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    displayName: text('display_name').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    businessIdIndex: index('groomer_staff_members_business_id_idx').on(
      table.businessId,
    ),
    businessUserUnique: index('groomer_staff_members_business_user_idx').on(
      table.businessId,
      table.userId,
    ),
  }),
);

export const appointments = pgTable(
  'appointments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => groomerBusinesses.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    groomerId: uuid('groomer_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    googleEventId: text('google_event_id'),
    locationType: locationTypeEnum('location_type').notNull(),
    startTime: timestamp('start_time', { withTimezone: true }).notNull(),
    endTime: timestamp('end_time', { withTimezone: true }).notNull(),
    status: appointmentStatusEnum('status').notNull(),
    cancelReason: text('cancel_reason'),
    homeAddress: text('home_address'),
    homeZone: text('home_zone'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    businessStartIndex: index('appointments_business_start_idx').on(
      table.businessId,
      table.startTime,
    ),
    clientIdIndex: index('appointments_client_id_idx').on(table.clientId),
  }),
);

export const appointmentPets = pgTable(
  'appointment_pets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    appointmentId: uuid('appointment_id')
      .notNull()
      .references(() => appointments.id, { onDelete: 'cascade' }),
    petId: uuid('pet_id')
      .notNull()
      .references(() => pets.id, { onDelete: 'cascade' }),
    serviceId: uuid('service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'cascade' }),
    calculatedDurationMinutes: integer('calculated_duration_minutes').notNull(),
    extras: jsonb('extras'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    appointmentIdIndex: index('appointment_pets_appointment_id_idx').on(
      table.appointmentId,
    ),
    petIdIndex: index('appointment_pets_pet_id_idx').on(table.petId),
  }),
);
