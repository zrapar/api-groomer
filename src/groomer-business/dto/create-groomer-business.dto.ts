import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { WorkingHourDto } from "./working-hour.dto";

export class CreateGroomerBusinessDto {
  @IsString()
  name: string;

  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: "slug must be lowercase and use hyphens only",
  })
  slug: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  coverImageUrl?: string;

  @IsOptional()
  @IsIn(["FREE", "PRO"])
  plan?: "FREE" | "PRO";

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
