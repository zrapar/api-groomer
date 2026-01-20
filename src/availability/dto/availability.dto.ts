import { ArrayNotEmpty, IsArray, IsEnum, IsString, ValidateNested } from "class-validator";
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

  @IsEnum(ServiceLocation)
  locationType: ServiceLocation;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => AvailabilityItemDto)
  items: AvailabilityItemDto[];
}
