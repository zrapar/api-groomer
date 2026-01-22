import { IsEmail, IsOptional, IsString, MinLength } from "class-validator";

export class CreateStaffDto {
  @IsEmail()
  email: string;

  @IsString()
  displayName: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}
