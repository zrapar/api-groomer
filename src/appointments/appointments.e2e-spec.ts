import { Test } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../app.module";
import { Pool } from "pg";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

const truncateAll = async (pool: Pool) => {
  await pool.query(`
    TRUNCATE TABLE
      appointment_pets,
      appointments,
      service_duration_rules,
      services,
      business_working_hours,
      groomer_businesses,
      pets,
      users
    RESTART IDENTITY CASCADE;
  `);
};

describe("Appointments flow", () => {
  let app: INestApplication;
  let pool: Pool;

  beforeAll(async () => {
    if (!testDatabaseUrl) {
      throw new Error("TEST_DATABASE_URL is not set");
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
  });

  beforeEach(async () => {
    await truncateAll(pool);
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  it("returns availability and blocks overlapping appointments", async () => {
    const groomerRegister = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        email: "groomer@test.local",
        password: "Password123!",
        role: "GROOMER_OWNER",
      });
    expect(groomerRegister.status).toBe(201);

    const groomerLogin = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: "groomer@test.local", password: "Password123!" });
    const groomerToken = groomerLogin.body.accessToken;

    const clientRegister = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        email: "client@test.local",
        password: "Password123!",
        role: "CLIENT",
      });
    expect(clientRegister.status).toBe(201);

    const clientLogin = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: "client@test.local", password: "Password123!" });
    const clientToken = clientLogin.body.accessToken;

    const business = await request(app.getHttpServer())
      .post("/api/v1/groomer-business")
      .set("Authorization", `Bearer ${groomerToken}`)
      .send({
        name: "Test Groomer",
        description: "Test",
        phone: "123",
        email: "biz@test.local",
        address: "Street 1",
        offersInSalon: true,
        offersAtHome: true,
        maxDogsPerHomeVisit: 2,
        homeVisitSetupMinutes: 10,
        homeVisitTeardownMinutes: 10,
        defaultTransportMinutes: 10,
        minHoursBeforeCancelOrReschedule: 24,
        workingHours: [
          { weekday: 1, startTime: "09:00", endTime: "18:00" },
        ],
      });

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
        isDefaultForSpecies: false,
      });

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

    const date = new Date();
    date.setDate(date.getDate() + 1);
    const dateString = date.toISOString().split("T")[0];

    const availability = await request(app.getHttpServer())
      .post(`/api/v1/groomers/${business.body.id}/availability`)
      .set("Authorization", `Bearer ${clientToken}`)
      .send({
        date: dateString,
        locationType: "IN_SALON",
        items: [{ petId: pet.body.id, serviceId: service.body.id }],
      });

    expect(availability.status).toBe(201);
    expect(Array.isArray(availability.body.slots)).toBe(true);
    expect(availability.body.slots.length).toBeGreaterThan(0);

    const startTime = availability.body.slots[0];

    const appointment = await request(app.getHttpServer())
      .post("/api/v1/appointments")
      .set("Authorization", `Bearer ${clientToken}`)
      .send({
        businessId: business.body.id,
        locationType: "IN_SALON",
        startTime,
        items: [{ petId: pet.body.id, serviceId: service.body.id }],
      });

    expect(appointment.status).toBe(201);

    const overlap = await request(app.getHttpServer())
      .post("/api/v1/appointments")
      .set("Authorization", `Bearer ${clientToken}`)
      .send({
        businessId: business.body.id,
        locationType: "IN_SALON",
        startTime,
        items: [{ petId: pet.body.id, serviceId: service.body.id }],
      });

    expect(overlap.status).toBe(400);
  });

  it("blocks max dogs per home visit", async () => {
    const groomerRegister = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        email: "groomer2@test.local",
        password: "Password123!",
        role: "GROOMER_OWNER",
      });
    expect(groomerRegister.status).toBe(201);

    const groomerLogin = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: "groomer2@test.local", password: "Password123!" });
    const groomerToken = groomerLogin.body.accessToken;

    const clientRegister = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        email: "client2@test.local",
        password: "Password123!",
        role: "CLIENT",
      });
    expect(clientRegister.status).toBe(201);

    const clientLogin = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: "client2@test.local", password: "Password123!" });
    const clientToken = clientLogin.body.accessToken;

    const business = await request(app.getHttpServer())
      .post("/api/v1/groomer-business")
      .set("Authorization", `Bearer ${groomerToken}`)
      .send({
        name: "Test Groomer",
        description: "Test",
        phone: "123",
        email: "biz2@test.local",
        address: "Street 1",
        offersInSalon: true,
        offersAtHome: true,
        maxDogsPerHomeVisit: 1,
        homeVisitSetupMinutes: 10,
        homeVisitTeardownMinutes: 10,
        defaultTransportMinutes: 10,
        minHoursBeforeCancelOrReschedule: 24,
        workingHours: [
          { weekday: 1, startTime: "09:00", endTime: "18:00" },
        ],
      });

    const service = await request(app.getHttpServer())
      .post("/api/v1/services")
      .set("Authorization", `Bearer ${groomerToken}`)
      .send({
        name: "Bath",
        description: "Bath",
        speciesSupported: ["DOG"],
        locationsSupported: ["AT_HOME"],
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

    const petOne = await request(app.getHttpServer())
      .post("/api/v1/pets")
      .set("Authorization", `Bearer ${clientToken}`)
      .send({
        species: "DOG",
        name: "Luna",
        breed: "Poodle",
        size: "SMALL",
        coatType: "CURLY",
      });

    const petTwo = await request(app.getHttpServer())
      .post("/api/v1/pets")
      .set("Authorization", `Bearer ${clientToken}`)
      .send({
        species: "DOG",
        name: "Nina",
        breed: "Beagle",
        size: "SMALL",
        coatType: "SHORT",
      });

    const date = new Date();
    date.setDate(date.getDate() + 1);
    const dateString = date.toISOString().split("T")[0];

    const availability = await request(app.getHttpServer())
      .post(`/api/v1/groomers/${business.body.id}/availability`)
      .set("Authorization", `Bearer ${clientToken}`)
      .send({
        date: dateString,
        locationType: "AT_HOME",
        items: [
          { petId: petOne.body.id, serviceId: service.body.id },
          { petId: petTwo.body.id, serviceId: service.body.id },
        ],
      });

    expect(availability.status).toBe(400);
  });
});
