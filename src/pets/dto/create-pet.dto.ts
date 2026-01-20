import {
  IsEnum,
  IsOptional,
  IsString,
  IsDateString,
  IsNumber,
  Min,
} from "class-validator";
import { CoatType, PetSize, PetSpecies } from "./pet.enums";

export class CreatePetDto {
  @IsEnum(PetSpecies)
  species: PetSpecies;

  @IsString()
  name: string;

  @IsString()
  breed: string;

  @IsEnum(PetSize)
  size: PetSize;

  @IsEnum(CoatType)
  coatType: CoatType;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  weightKg?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
