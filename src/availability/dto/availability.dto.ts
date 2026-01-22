import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { ServiceLocation } from "../../services/dto/service.enums";

export class AvailabilityItemDto {
  @IsString()
  petId: string;

  @IsString()
  serviceId: string;
}

export class AvailabilityRequestDto {
  @IsString()
  date: string;

  @IsOptional()
  @IsString()
  groomerId?: string;

  @IsEnum(ServiceLocation)
  locationType: ServiceLocation;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => AvailabilityItemDto)
  items: AvailabilityItemDto[];
}
