import { IsOptional, IsString } from "class-validator";

export class UpdateAppointmentDto {
  @IsOptional()
  @IsString()
  startTime?: string;

  @IsOptional()
  @IsString()
  homeAddress?: string;

  @IsOptional()
  @IsString()
  homeZone?: string;
}
