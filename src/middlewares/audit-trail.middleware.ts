import { AuditLogSeverity } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { AuditLogRepository } from '../repositories/audit-log.repository';

const auditLogRepository = new AuditLogRepository();
const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const EXCLUDED_PREFIXES = ['/api/health', '/api/auth/internal', '/api/auth/csrf'];

const resolveClientIp = (req: Request): string | null => {
  const forwarded = req.headers['x-forwarded-for'];

  if (Array.isArray(forwarded)) {
    return forwarded[0]?.split(',')[0]?.trim() || null;
  }

  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0]?.trim() || null;
  }

  return req.socket.remoteAddress ?? null;
};

const shouldSkipRoute = (route: string) => {
  return EXCLUDED_PREFIXES.some((prefix) => route === prefix || route.startsWith(`${prefix}/`));
};

export const auditTrailMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  res.on('finish', () => {
    if (!req.authSession) {
      return;
    }

    if (!MUTATION_METHODS.has(req.method.toUpperCase())) {
      return;
    }

    if (res.statusCode >= 500) {
      return;
    }

    const route = req.baseUrl ? `${req.baseUrl}${req.path}` : req.path;
    if (shouldSkipRoute(route)) {
      return;
    }

    void auditLogRepository
      .create({
        actorUserId: req.authSession.user.id,
        action: 'HTTP_MUTATION_EXECUTED',
        severity: AuditLogSeverity.INFO,
        companyId: req.authSession.user.companyId ?? undefined,
        targetType: 'API_ROUTE',
        targetId: route,
        requestId: req.requestId,
        ipAddress: resolveClientIp(req) ?? undefined,
        userAgent:
          typeof req.headers['user-agent'] === 'string'
            ? req.headers['user-agent']
            : undefined,
        metadata: {
          method: req.method,
          route,
          statusCode: res.statusCode
        }
      })
      .then((result) => {
        if (result.persisted) {
          return;
        }

        logger.warn('audit_trail_write_skipped_non_blocking', {
          requestId: req.requestId,
          route,
          actorUserId: req.authSession?.user.id ?? null,
          errorCode: result.errorCode ?? null,
          errorMessage: result.errorMessage ?? null
        });
      });
  });

  next();
};
