import "dotenv/config";
import { Test } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { Pool } from "pg";
import fs from "fs";

const isDocker = fs.existsSync("/.dockerenv");

const normalizeDatabaseUrl = (rawUrl?: string) => {
  if (!rawUrl) {
    return undefined;
  }
  try {
    const parsed = new URL(rawUrl);
    if (!isDocker && parsed.hostname === "postgres") {
      parsed.hostname = "localhost";
    }
    return parsed.toString();
  } catch {
    return rawUrl;
  }
};

const testDatabaseUrl = normalizeDatabaseUrl(
  process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
);

const truncateAll = async (pool: Pool) => {
  await pool.query(`
    TRUNCATE TABLE
      appointment_pets,
      appointments,
      service_duration_rules,
      services,
      business_working_hours,
      groomer_staff_members,
      groomer_businesses,
      pets,
      users
    RESTART IDENTITY CASCADE;
  `);
};

describe("Client flows", () => {
  let app: INestApplication;
  let pool: Pool;
  let isReady = false;

  beforeAll(async () => {
    if (!testDatabaseUrl) {
      console.warn("TEST_DATABASE_URL is not set; skipping client e2e tests.");
      return;
    }
    process.env.DATABASE_URL = testDatabaseUrl;
    pool = new Pool({ connectionString: testDatabaseUrl });
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    isReady = true;
  });

  beforeEach(async () => {
    if (!isReady) {
      return;
    }
    await truncateAll(pool);
  });

  afterAll(async () => {
    if (!isReady) {
      return;
    }
    await app.close();
    await pool.end();
  });

  it("handles email status and client login-lite", async () => {
    if (!isReady) {
      return;
    }
    await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        email: "groomer@login.local",
        password: "Password123!",
        role: "GROOMER_OWNER",
      });

    const groomerStatus = await request(app.getHttpServer())
      .post("/api/v1/auth/email-status")
      .send({ email: "groomer@login.local" });
    expect(groomerStatus.status).toBe(201);
    expect(groomerStatus.body.requiresPassword).toBe(true);

    const clientStatus = await request(app.getHttpServer())
      .post("/api/v1/auth/email-status")
      .send({ email: "client@login.local" });
    expect(clientStatus.status).toBe(201);
    expect(clientStatus.body.requiresPassword).toBe(false);

    const clientLogin = await request(app.getHttpServer())
      .post("/api/v1/auth/login-lite")
      .send({ email: "client@login.local" });
    expect(clientLogin.status).toBe(201);
    expect(clientLogin.body.accessToken).toBeDefined();
  });

  it("allows client cancellation within window and blocks late cancellation", async () => {
    if (!isReady) {
      return;
    }
    const groomerRegister = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        email: "groomer@clientflow.local",
        password: "Password123!",
        role: "GROOMER_OWNER",
      });
    expect(groomerRegister.status).toBe(201);

    const groomerLogin = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: "groomer@clientflow.local", password: "Password123!" });
    const groomerToken = groomerLogin.body.accessToken;

    const business = await request(app.getHttpServer())
      .post("/api/v1/groomer-business")
      .set("Authorization", `Bearer ${groomerToken}`)
      .send({
        slug: "client-flow-biz",
        name: "Client Flow Biz",
        description: "Test",
        phone: "123",
        email: "biz@clientflow.local",
        address: "Street 1",
        offersInSalon: true,
        offersAtHome: false,
        homeVisitSetupMinutes: 0,
        homeVisitTeardownMinutes: 0,
        defaultTransportMinutes: 0,
        minHoursBeforeCancelOrReschedule: 24,
        workingHours: [
          { weekday: 1, startTime: "00:00", endTime: "23:59" },
        ],
      });
    expect(business.status).toBe(201);

    const service = await request(app.getHttpServer())
      .post("/api/v1/services")
      .set("Authorization", `Bearer ${groomerToken}`)
      .send({
        name: "Bath",
        description: "Bath",
        speciesSupported: ["DOG"],
        locationsSupported: ["IN_SALON"],
        isActive: true,
      });

    await request(app.getHttpServer())
      .post(`/api/v1/services/${service.body.id}/duration-rules`)
      .set("Authorization", `Bearer ${groomerToken}`)
      .send({
        species: "DOG",
        size: "SMALL",
        baseDurationMinutes: 60,
        isDefaultForSpecies: true,
      });

    const clientLogin = await request(app.getHttpServer())
      .post("/api/v1/auth/login-lite")
      .send({ email: "client@clientflow.local" });
    const clientToken = clientLogin.body.accessToken;

    const pet = await request(app.getHttpServer())
      .post("/api/v1/pets")
      .set("Authorization", `Bearer ${clientToken}`)
      .send({
        species: "DOG",
        name: "Luna",
        breed: "Poodle",
        size: "SMALL",
        coatType: "CURLY",
      });

    const startTimeSoon = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const startTimeLater = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    const appointmentSoon = await request(app.getHttpServer())
      .post("/api/v1/appointments")
      .set("Authorization", `Bearer ${clientToken}`)
      .send({
        businessId: business.body.id,
        locationType: "IN_SALON",
        startTime: startTimeSoon,
        items: [{ petId: pet.body.id, serviceId: service.body.id }],
      });
    expect(appointmentSoon.status).toBe(201);

    const appointmentLater = await request(app.getHttpServer())
      .post("/api/v1/appointments")
      .set("Authorization", `Bearer ${clientToken}`)
      .send({
        businessId: business.body.id,
        locationType: "IN_SALON",
        startTime: startTimeLater,
        items: [{ petId: pet.body.id, serviceId: service.body.id }],
      });
    expect(appointmentLater.status).toBe(201);

    const cancelLate = await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${appointmentSoon.body.id}/cancel`)
      .set("Authorization", `Bearer ${clientToken}`)
      .send({ cancelReason: "Too late" });
    expect(cancelLate.status).toBe(400);

    const cancelOk = await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${appointmentLater.body.id}/cancel`)
      .set("Authorization", `Bearer ${clientToken}`)
      .send({ cancelReason: "Change of plans" });
    expect(cancelOk.status).toBe(200);
    expect(cancelOk.body.status).toBe("CANCELLED");
  });

  it("covers client flow: login, pets, booking, and list appointments", async () => {
    if (!isReady) {
      return;
    }

    const groomerRegister = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        email: "groomer@booking.local",
        password: "Password123!",
        role: "GROOMER_OWNER",
      });
    expect(groomerRegister.status).toBe(201);

    const groomerLogin = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: "groomer@booking.local", password: "Password123!" });
    const groomerToken = groomerLogin.body.accessToken;

    const business = await request(app.getHttpServer())
      .post("/api/v1/groomer-business")
      .set("Authorization", `Bearer ${groomerToken}`)
      .send({
        slug: "booking-flow-biz",
        name: "Booking Flow",
        description: "Test",
        phone: "123",
        email: "biz@booking.local",
        address: "Street 1",
        offersInSalon: true,
        offersAtHome: true,
        maxDogsPerHomeVisit: 2,
        homeVisitSetupMinutes: 10,
        homeVisitTeardownMinutes: 10,
        defaultTransportMinutes: 10,
        minHoursBeforeCancelOrReschedule: 12,
        workingHours: [
          { weekday: 1, startTime: "09:00", endTime: "18:00" },
        ],
      });
    expect(business.status).toBe(201);

    const service = await request(app.getHttpServer())
      .post("/api/v1/services")
      .set("Authorization", `Bearer ${groomerToken}`)
      .send({
        name: "Bath",
        description: "Bath",
        speciesSupported: ["DOG"],
        locationsSupported: ["IN_SALON"],
        isActive: true,
      });
    expect(service.status).toBe(201);

    await request(app.getHttpServer())
      .post(`/api/v1/services/${service.body.id}/duration-rules`)
      .set("Authorization", `Bearer ${groomerToken}`)
      .send({
        species: "DOG",
        size: "SMALL",
        baseDurationMinutes: 60,
        isDefaultForSpecies: true,
      });

    const clientLogin = await request(app.getHttpServer())
      .post("/api/v1/auth/login-lite")
      .send({ email: "client@booking.local" });
    expect(clientLogin.status).toBe(201);
    const clientToken = clientLogin.body.accessToken;

    const petCreate = await request(app.getHttpServer())
      .post("/api/v1/pets")
      .set("Authorization", `Bearer ${clientToken}`)
      .send({
        species: "DOG",
        name: "Luna",
        breed: "Poodle",
        size: "SMALL",
        coatType: "CURLY",
      });
    expect(petCreate.status).toBe(201);

    const petsList = await request(app.getHttpServer())
      .get("/api/v1/pets")
      .set("Authorization", `Bearer ${clientToken}`);
    expect(petsList.status).toBe(200);
    expect(petsList.body.length).toBe(1);

    const nextMonday = new Date();
    const day = nextMonday.getDay();
    const daysUntilMonday = (8 - day) % 7 || 7;
    nextMonday.setDate(nextMonday.getDate() + daysUntilMonday);
    const dateString = [
      nextMonday.getFullYear(),
      String(nextMonday.getMonth() + 1).padStart(2, "0"),
      String(nextMonday.getDate()).padStart(2, "0"),
    ].join("-");

    const availability = await request(app.getHttpServer())
      .post(`/api/v1/groomers/${business.body.id}/availability`)
      .set("Authorization", `Bearer ${clientToken}`)
      .send({
        date: dateString,
        locationType: "IN_SALON",
        items: [{ petId: petCreate.body.id, serviceId: service.body.id }],
      });
    expect(availability.status).toBe(201);
    expect(availability.body.slots.length).toBeGreaterThan(0);

    const appointment = await request(app.getHttpServer())
      .post("/api/v1/appointments")
      .set("Authorization", `Bearer ${clientToken}`)
      .send({
        businessId: business.body.id,
        locationType: "IN_SALON",
        startTime: availability.body.slots[0],
        items: [{ petId: petCreate.body.id, serviceId: service.body.id }],
      });
    expect(appointment.status).toBe(201);

    const appointmentsList = await request(app.getHttpServer())
      .get("/api/v1/appointments")
      .set("Authorization", `Bearer ${clientToken}`);
    expect(appointmentsList.status).toBe(200);
    expect(appointmentsList.body.length).toBe(1);
    expect(appointmentsList.body[0].items?.length).toBeGreaterThan(0);
  });
});
