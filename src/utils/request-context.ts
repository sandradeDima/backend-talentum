import type { Request } from 'express';

export type AuditRequestContext = {
  requestId?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
};

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

export const buildAuditContext = (req: Request): AuditRequestContext => {
  return {
    requestId: req.requestId,
    ipAddress: resolveClientIp(req),
    userAgent: req.headers['user-agent'] ?? null
  };
};
