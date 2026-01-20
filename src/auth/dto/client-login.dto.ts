import { IsEmail } from "class-validator";

export class ClientLoginDto {
  @IsEmail()
  email: string;
}
