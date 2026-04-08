import { Role } from '@prisma/client';
import { AppError } from '../errors/appError';
import type { SessionPrincipal } from '../types/auth';

export const rolePolicy = {
  adminOnly: [Role.ADMIN] as const,
  adminAndClientAdmin: [Role.ADMIN, Role.CLIENT_ADMIN] as const
};

export const assertPrincipalRole = (
  principal: SessionPrincipal,
  allowedRoles: readonly Role[],
  options?: {
    message?: string;
    code?: string;
  }
) => {
  if (allowedRoles.includes(principal.role)) {
    return;
  }

  throw new AppError(
    options?.message ?? 'No tienes permisos para esta acción',
    403,
    options?.code ?? 'ROLE_FORBIDDEN'
  );
};
