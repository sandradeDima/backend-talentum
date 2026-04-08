import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

const normalizeRequestId = (value: string | string[] | undefined): string | null => {
  if (Array.isArray(value)) {
    return normalizeRequestId(value[0]);
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= 120 ? trimmed : null;
};

export const requestContextMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const incomingRequestId = normalizeRequestId(req.headers['x-request-id']);
  const requestId = incomingRequestId ?? randomUUID();

  req.requestId = requestId;
  req.requestStartedAt = Date.now();

  res.setHeader('x-request-id', requestId);
  next();
};
