import { IsArray, IsBoolean, IsEnum, IsString, ArrayNotEmpty } from "class-validator";
import { ServiceLocation, ServiceSpecies } from "./service.enums";

export class CreateServiceDto {
  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(ServiceSpecies, { each: true })
  speciesSupported: ServiceSpecies[];

  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(ServiceLocation, { each: true })
  locationsSupported: ServiceLocation[];

  @IsBoolean()
  isActive: boolean;
}
