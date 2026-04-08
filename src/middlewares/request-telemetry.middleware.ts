import type { NextFunction, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { monitoringService } from '../services/monitoring.service';

const resolveClientIp = (req: Request): string | null => {
  const forwarded = req.headers['x-forwarded-for'];

  if (Array.isArray(forwarded) && forwarded.length > 0) {
    const first = forwarded[0]?.split(',')[0]?.trim();
    return first || null;
  }

  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0]?.trim() || null;
  }

  return req.socket.remoteAddress ?? null;
};

export const requestTelemetryMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const startedAt = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    const route = req.baseUrl ? `${req.baseUrl}${req.path}` : req.path;

    monitoringService.recordRequest({
      method: req.method,
      route,
      statusCode: res.statusCode,
      durationMs
    });

    logger.info('http_request', {
      requestId: req.requestId,
      method: req.method,
      route,
      statusCode: res.statusCode,
      durationMs,
      clientIp: resolveClientIp(req),
      userAgent: req.headers['user-agent'] ?? null,
      actorUserId: req.authSession?.user.id ?? null
    });
  });

  next();
};
