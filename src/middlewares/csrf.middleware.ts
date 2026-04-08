import { timingSafeEqual } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';
import { AppError } from '../errors/appError';
import { randomToken } from '../utils/hash';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const PROTECTED_PATH_PREFIXES = [
  '/admin',
  '/companies',
  '/dashboard',
  '/uploads',
  '/resource-library',
  '/support-config',
  '/auth/logout'
];

export const CSRF_COOKIE_NAME = env.CSRF_COOKIE_NAME;
export const CSRF_HEADER_NAME = 'x-csrf-token';

const parseCookies = (cookieHeader: string | undefined): Record<string, string> => {
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader
    .split(';')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .reduce<Record<string, string>>((acc, entry) => {
      const separatorIndex = entry.indexOf('=');
      if (separatorIndex <= 0) {
        return acc;
      }

      const key = decodeURIComponent(entry.slice(0, separatorIndex).trim());
      const value = decodeURIComponent(entry.slice(separatorIndex + 1).trim());
      if (key) {
        acc[key] = value;
      }

      return acc;
    }, {});
};

const getHeaderValue = (req: Request, name: string): string | null => {
  const value = req.headers[name];
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  return null;
};

const safeTokenCompare = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
};

const shouldProtectPath = (path: string): boolean => {
  return PROTECTED_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  );
};

export const ensureCsrfCookie = (req: Request, res: Response): string => {
  const cookies = parseCookies(req.headers.cookie);
  const existing = cookies[CSRF_COOKIE_NAME];

  if (existing && existing.length >= 24) {
    return existing;
  }

  const token = randomToken(24);
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24 * 7,
    path: '/'
  });

  return token;
};

export const csrfProtectionMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (SAFE_METHODS.has(req.method.toUpperCase())) {
    next();
    return;
  }

  if (!shouldProtectPath(req.path)) {
    next();
    return;
  }

  const cookies = parseCookies(req.headers.cookie);
  const cookieToken = cookies[CSRF_COOKIE_NAME];
  const headerToken = getHeaderValue(req, CSRF_HEADER_NAME);

  if (!cookieToken || !headerToken || !safeTokenCompare(cookieToken, headerToken)) {
    next(new AppError('Solicitud inválida', 403, 'CSRF_TOKEN_INVALID'));
    return;
  }

  next();
};
