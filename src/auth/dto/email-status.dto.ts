import { IsEmail } from "class-validator";

export class EmailStatusDto {
  @IsEmail()
  email: string;
}
