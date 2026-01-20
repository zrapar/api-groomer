import { IsObject, IsOptional, IsString } from "class-validator";

export class AppointmentItemDto {
  @IsString()
  petId: string;

  @IsString()
  serviceId: string;

  @IsOptional()
  @IsObject()
  extras?: Record<string, unknown>;
}
