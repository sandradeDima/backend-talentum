import type { Role } from '@prisma/client';

export type SessionPrincipal = {
  id: string;
  email: string;
  name: string;
  role: Role;
  companyId: string | null;
  companySlug: string | null;
  isActive: boolean;
};

export type SessionPayload = {
  session: {
    id: string;
    token: string;
    userId: string;
    expiresAt: Date;
  };
  user: SessionPrincipal;
};
