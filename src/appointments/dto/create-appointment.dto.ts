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
import { AppointmentItemDto } from "./appointment-item.dto";

export class CreateAppointmentDto {
  @IsString()
  businessId: string;

  @IsOptional()
  @IsString()
  groomerId?: string;

  @IsEnum(ServiceLocation)
  locationType: ServiceLocation;

  @IsString()
  startTime: string;

  @IsOptional()
  @IsString()
  homeAddress?: string;

  @IsOptional()
  @IsString()
  homeZone?: string;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => AppointmentItemDto)
  items: AppointmentItemDto[];
}
