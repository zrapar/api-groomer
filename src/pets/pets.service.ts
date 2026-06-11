import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PetRepository } from '../repositories/pet.repository';
import { AuthUser } from '../auth/types/auth-user';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdatePetDto } from './dto/update-pet.dto';

@Injectable()
export class PetsService {
  constructor(private readonly petRepo: PetRepository) {}

  async list(owner: AuthUser, limit = 100, offset = 0) {
    return this.petRepo.findByOwnerId(owner.id, limit, offset);
  }

  async create(owner: AuthUser, payload: CreatePetDto) {
    return this.petRepo.create(owner.id, {
      species: payload.species,
      name: payload.name,
      breed: payload.breed,
      size: payload.size,
      coatType: payload.coatType,
      birthDate: payload.birthDate ? new Date(payload.birthDate) : null,
      weightKg: payload.weightKg ? String(payload.weightKg) : null,
      notes: payload.notes,
    });
  }

  async update(owner: AuthUser, petId: string, payload: UpdatePetDto) {
    const pet = await this.petRepo.findById(petId);
    if (!pet) throw new NotFoundException('Pet not found.');
    if (pet.ownerUserId !== owner.id)
      throw new ForbiddenException('You do not own this pet.');

    return this.petRepo.update(petId, {
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
    });
  }

  async remove(owner: AuthUser, petId: string) {
    const pet = await this.petRepo.findById(petId);
    if (!pet) throw new NotFoundException('Pet not found.');
    if (pet.ownerUserId !== owner.id)
      throw new ForbiddenException('You do not own this pet.');
    await this.petRepo.delete(petId, owner.id);
    return { deleted: true };
  }
}
