import { UserRole } from '../dto/user-role.enum';

export type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
};
