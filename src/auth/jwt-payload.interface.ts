import { UserRole } from '../generated/prisma/enums.js';

export interface JwtPayload {
  sub: number;
  email: string;
  role: UserRole;
}
