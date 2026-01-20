import { UserRole } from "../dto/user-role.enum";

export type JwtPayload = {
  sub: string;
  email: string;
  role: UserRole;
  tokenType: "access" | "refresh";
};
