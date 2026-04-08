import type { NextFunction, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { errorResponse } from '../utils/apiResponse';

type RateLimitOptions = {
  name: string;
  windowMs: number;
  maxRequests: number;
  keyResolver?: (req: Request) => string;
  skip?: (req: Request) => boolean;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const DEFAULT_KEY_RESOLVER = (req: Request) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (Array.isArray(forwarded) && forwarded[0]) {
    return forwarded[0].split(',')[0]?.trim() || 'unknown';
  }

  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0]?.trim() || 'unknown';
  }

  return req.socket.remoteAddress ?? 'unknown';
};

export const createRateLimiter = (options: RateLimitOptions) => {
  const store = new Map<string, RateLimitBucket>();

  const cleanup = () => {
    const now = Date.now();
    for (const [key, bucket] of store.entries()) {
      if (bucket.resetAt <= now) {
        store.delete(key);
      }
    }
  };

  setInterval(cleanup, Math.max(1000, options.windowMs)).unref();

  return (req: Request, res: Response, next: NextFunction) => {
    if (options.skip?.(req)) {
      next();
      return;
    }

    const keyResolver = options.keyResolver ?? DEFAULT_KEY_RESOLVER;
    const identity = `${options.name}:${keyResolver(req)}`;
    const now = Date.now();
    const current = store.get(identity);

    if (!current || current.resetAt <= now) {
      store.set(identity, {
        count: 1,
        resetAt: now + options.windowMs
      });
      next();
      return;
    }

    if (current.count >= options.maxRequests) {
      const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));

      logger.warn('rate_limit_exceeded', {
        limiter: options.name,
        identity,
        method: req.method,
        path: req.originalUrl,
        requestId: req.requestId
      });

      res
        .status(429)
        .json(
          errorResponse(
            'Demasiadas solicitudes. Intenta nuevamente en unos segundos.',
            'RATE_LIMIT_EXCEEDED'
          )
        );
      return;
    }

    current.count += 1;
    store.set(identity, current);

    next();
  };
};
