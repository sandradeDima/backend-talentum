import type { NextFunction, Request, Response } from 'express';
import { Role } from '@prisma/client';
import { AppError } from '../errors/appError';
import { authService } from '../lib/container';

const OPTIONAL_AUTH_IGNORED_CODES = new Set(['SESSION_NOT_FOUND', 'SESSION_USER_INVALID']);

export const requireAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    req.authSession = await authService.getSessionPayload(req.headers);
    next();
  } catch (error) {
    next(error);
  }
};

export const attachOptionalAuthSession = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    req.authSession = await authService.getSessionPayload(req.headers);
    next();
  } catch (error) {
    if (
      error instanceof AppError &&
      error.mensajeTecnico &&
      OPTIONAL_AUTH_IGNORED_CODES.has(error.mensajeTecnico)
    ) {
      req.authSession = undefined;
      next();
      return;
    }

    next(error);
  }
};

export const requireRole = (allowedRoles: readonly Role[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.authSession) {
      next(new AppError('No autenticado', 401, 'SESSION_NOT_FOUND'));
      return;
    }

    if (!allowedRoles.includes(req.authSession.user.role)) {
      next(new AppError('No tienes permisos para esta acción', 403, 'ROLE_FORBIDDEN'));
      return;
    }

    next();
  };
};

export const requireAdmin = requireRole([Role.ADMIN]);

export const requireRespondentOnlyAccess = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  if (req.authSession) {
    next(
      new AppError(
        'Este endpoint está reservado para acceso de respondentes',
        403,
        'RESPONDENT_ONLY_ENDPOINT'
      )
    );
    return;
  }

  next();
};

export const requireCompanyAccess = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  if (!req.authSession) {
    next(new AppError('No autenticado', 401, 'SESSION_NOT_FOUND'));
    return;
  }

  const principal = req.authSession.user;
  if (principal.role === Role.ADMIN) {
    next();
    return;
  }

  const rawTargetCompanyId = req.params.id ?? req.params.companyId ?? req.body?.companyId;
  const targetCompanyId = Array.isArray(rawTargetCompanyId)
    ? rawTargetCompanyId[0]
    : rawTargetCompanyId;

  if (!targetCompanyId) {
    next(new AppError('No se pudo determinar la empresa objetivo', 400, 'MISSING_COMPANY_SCOPE'));
    return;
  }

  if (!principal.companyId || principal.companyId !== targetCompanyId) {
    next(new AppError('Acceso denegado a la empresa solicitada', 403, 'COMPANY_SCOPE_FORBIDDEN'));
    return;
  }

  next();
};
