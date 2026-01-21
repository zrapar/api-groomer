import { IsEmail, IsOptional, MinLength } from "class-validator";

export class LoginLiteDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @MinLength(8)
  password?: string;
}
