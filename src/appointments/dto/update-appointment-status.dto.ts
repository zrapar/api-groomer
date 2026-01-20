import { IsEnum, IsOptional, IsString } from "class-validator";
import { AppointmentStatus } from "./appointment.enums";

export class UpdateAppointmentStatusDto {
  @IsEnum(AppointmentStatus)
  status: AppointmentStatus;

  @IsOptional()
  @IsString()
  cancelReason?: string;
}
