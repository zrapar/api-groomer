import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min } from "class-validator";
import { PetSize, PetSpecies } from "../../pets/dto/pet.enums";

export class CreateServiceDurationRuleDto {
  @IsEnum(PetSpecies)
  species: PetSpecies;

  @IsOptional()
  @IsEnum(PetSize)
  size?: PetSize;

  @IsOptional()
  @IsString()
  breed?: string;

  @IsInt()
  @Min(1)
  baseDurationMinutes: number;

  @IsOptional()
  @IsBoolean()
  isDefaultForSpecies?: boolean;
}

export class UpdateServiceDurationRuleDto {
  @IsOptional()
  @IsEnum(PetSpecies)
  species?: PetSpecies;

  @IsOptional()
  @IsEnum(PetSize)
  size?: PetSize;

  @IsOptional()
  @IsString()
  breed?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  baseDurationMinutes?: number;

  @IsOptional()
  @IsBoolean()
  isDefaultForSpecies?: boolean;
}
