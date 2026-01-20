import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { WorkingHourDto } from "./working-hour.dto";

export class CreateGroomerBusinessDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  phone: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  address: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsBoolean()
  offersInSalon: boolean;

  @IsBoolean()
  offersAtHome: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxDogsPerHomeVisit?: number;

  @IsInt()
  @Min(0)
  homeVisitSetupMinutes: number;

  @IsInt()
  @Min(0)
  homeVisitTeardownMinutes: number;

  @IsInt()
  @Min(0)
  defaultTransportMinutes: number;

  @IsInt()
  @Min(0)
  minHoursBeforeCancelOrReschedule: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkingHourDto)
  workingHours?: WorkingHourDto[];
}
