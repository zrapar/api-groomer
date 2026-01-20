import {
  Inject,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { eq, and } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { DRIZZLE_DB } from "../db/db.module";
import * as schema from "../db/schema";
import { AuthUser } from "../auth/types/auth-user";
import { CreatePetDto } from "./dto/create-pet.dto";
import { UpdatePetDto } from "./dto/update-pet.dto";

@Injectable()
export class PetsService {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async list(owner: AuthUser) {
    return this.db
      .select()
      .from(schema.pets)
      .where(eq(schema.pets.ownerUserId, owner.id));
  }

  async create(owner: AuthUser, payload: CreatePetDto) {
    const [pet] = await this.db
      .insert(schema.pets)
      .values({
        ownerUserId: owner.id,
        species: payload.species,
        name: payload.name,
        breed: payload.breed,
        size: payload.size,
        coatType: payload.coatType,
        birthDate: payload.birthDate ? new Date(payload.birthDate) : null,
        weightKg: payload.weightKg ? String(payload.weightKg) : null,
        notes: payload.notes,
      })
      .returning();

    return pet;
  }

  async update(owner: AuthUser, petId: string, payload: UpdatePetDto) {
    const [pet] = await this.db
      .select()
      .from(schema.pets)
      .where(eq(schema.pets.id, petId));

    if (!pet) {
      throw new NotFoundException("Pet not found.");
    }

    if (pet.ownerUserId !== owner.id) {
      throw new ForbiddenException("You do not own this pet.");
    }

    const [updated] = await this.db
      .update(schema.pets)
      .set({
        species: payload.species ?? pet.species,
        name: payload.name ?? pet.name,
        breed: payload.breed ?? pet.breed,
        size: payload.size ?? pet.size,
        coatType: payload.coatType ?? pet.coatType,
        birthDate:
          payload.birthDate !== undefined
            ? payload.birthDate
              ? new Date(payload.birthDate)
              : null
            : pet.birthDate,
        weightKg:
          payload.weightKg !== undefined
            ? payload.weightKg
              ? String(payload.weightKg)
              : null
            : pet.weightKg,
        notes: payload.notes ?? pet.notes,
        updatedAt: new Date(),
      })
      .where(eq(schema.pets.id, petId))
      .returning();

    return updated;
  }

  async remove(owner: AuthUser, petId: string) {
    const [pet] = await this.db
      .select()
      .from(schema.pets)
      .where(eq(schema.pets.id, petId));

    if (!pet) {
      throw new NotFoundException("Pet not found.");
    }

    if (pet.ownerUserId !== owner.id) {
      throw new ForbiddenException("You do not own this pet.");
    }

    await this.db
      .delete(schema.pets)
      .where(and(eq(schema.pets.id, petId), eq(schema.pets.ownerUserId, owner.id)));

    return { deleted: true };
  }
}
