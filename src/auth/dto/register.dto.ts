import { IsEmail, IsEnum, IsOptional, MinLength } from "class-validator";
import { UserRole } from "./user-role.enum";

export class RegisterDto {
  @IsEmail()
  email: string;

  @MinLength(8)
  @IsOptional()
  password?: string;

  @IsEnum(UserRole)
  role: UserRole;
}
