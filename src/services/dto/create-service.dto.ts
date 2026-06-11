import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  ArrayNotEmpty,
  Length,
  Min,
} from 'class-validator';
import { ServiceLocation, ServiceSpecies } from './service.enums';

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

  @IsOptional()
  @IsNumber()
  @Min(0)
  priceAmount?: number;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  priceCurrency?: string;

  @IsBoolean()
  isActive: boolean;
}
