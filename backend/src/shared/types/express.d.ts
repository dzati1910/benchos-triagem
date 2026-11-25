import type { Role } from '@prisma/client';

export interface AuthenticatedUser {
  id: number;
  nome: string;
  email: string;
  role: Role;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
