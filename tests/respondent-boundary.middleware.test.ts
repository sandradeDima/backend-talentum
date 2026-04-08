import assert from 'node:assert/strict';
import test from 'node:test';
import { Role } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../src/errors/appError';
import { authService } from '../src/lib/container';
import {
  attachOptionalAuthSession,
  requireRespondentOnlyAccess
} from '../src/middlewares/auth.middleware';

const makeNextTracker = () => {
  let called = false;
  let receivedError: unknown;

  const next: NextFunction = (error?: unknown) => {
    called = true;
    receivedError = error;
  };

  return {
    next,
    wasCalled: () => called,
    error: () => receivedError
  };
};

test('attachOptionalAuthSession attaches session when request is authenticated', async () => {
  const original = authService.getSessionPayload;
  const req = { headers: {} } as Request;
  const tracker = makeNextTracker();

  (authService as { getSessionPayload: typeof authService.getSessionPayload }).getSessionPayload =
    (async () => ({
      session: {
        id: 'session_1',
        token: 'token_1',
        userId: 'user_1',
        expiresAt: new Date('2099-01-01T00:00:00.000Z')
      },
      user: {
        id: 'user_1',
        email: 'admin@talentum.test',
        name: 'Admin',
        role: Role.ADMIN,
        companyId: null,
        companySlug: null,
        isActive: true
      }
    })) as typeof authService.getSessionPayload;

  try {
    await attachOptionalAuthSession(req, {} as Response, tracker.next);
    assert.equal(tracker.wasCalled(), true);
    assert.equal(tracker.error(), undefined);
    assert.equal(req.authSession?.user.id, 'user_1');
  } finally {
    (authService as { getSessionPayload: typeof authService.getSessionPayload }).getSessionPayload =
      original;
  }
});

test('attachOptionalAuthSession ignores missing session errors', async () => {
  const original = authService.getSessionPayload;
  const req = { headers: {} } as Request;
  const tracker = makeNextTracker();

  (authService as { getSessionPayload: typeof authService.getSessionPayload }).getSessionPayload =
    (async () => {
      throw new AppError('No autenticado', 401, 'SESSION_NOT_FOUND');
    }) as typeof authService.getSessionPayload;

  try {
    await attachOptionalAuthSession(req, {} as Response, tracker.next);
    assert.equal(tracker.wasCalled(), true);
    assert.equal(tracker.error(), undefined);
    assert.equal(req.authSession, undefined);
  } finally {
    (authService as { getSessionPayload: typeof authService.getSessionPayload }).getSessionPayload =
      original;
  }
});

test('requireRespondentOnlyAccess rejects authenticated sessions', () => {
  const req = {
    authSession: {
      session: {
        id: 'session_1',
        token: 'token_1',
        userId: 'user_1',
        expiresAt: new Date('2099-01-01T00:00:00.000Z')
      },
      user: {
        id: 'user_1',
        email: 'admin@talentum.test',
        name: 'Admin',
        role: Role.ADMIN,
        companyId: null,
        companySlug: null,
        isActive: true
      }
    }
  } as Request;
  const tracker = makeNextTracker();

  requireRespondentOnlyAccess(req, {} as Response, tracker.next);

  assert.equal(tracker.wasCalled(), true);
  assert.ok(tracker.error() instanceof AppError);
  assert.equal((tracker.error() as AppError).mensajeTecnico, 'RESPONDENT_ONLY_ENDPOINT');
});

test('requireRespondentOnlyAccess allows anonymous respondent requests', () => {
  const req = {} as Request;
  const tracker = makeNextTracker();

  requireRespondentOnlyAccess(req, {} as Response, tracker.next);

  assert.equal(tracker.wasCalled(), true);
  assert.equal(tracker.error(), undefined);
});
