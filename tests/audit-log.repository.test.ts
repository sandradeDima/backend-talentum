import assert from 'node:assert/strict';
import test from 'node:test';
import { AuditLogRepository } from '../src/repositories/audit-log.repository';

test('AuditLogRepository.create persists audit entries when database write succeeds', async () => {
  const repository = new AuditLogRepository();
  const calls: unknown[] = [];

  const fakeDb = {
    auditLog: {
      create: async (args: unknown) => {
        calls.push(args);
      }
    },
    $executeRaw: async () => {
      throw new Error('fallback should not execute for successful audit writes');
    }
  };

  const result = await repository.create(
    {
      actorUserId: 'user_1',
      action: 'COMPANY_CREATED',
      companyId: 'company_1',
      targetType: 'COMPANY',
      targetId: 'company_1',
      metadata: { source: 'test' }
    },
    fakeDb as never
  );

  assert.equal(result.persisted, true);
  assert.equal(result.fallbackUsed, false);
  assert.equal(calls.length, 1);
});

test('AuditLogRepository.create falls back to legacy insert when new audit columns are missing', async () => {
  const repository = new AuditLogRepository();
  let fallbackCalls = 0;

  const fakeDb = {
    auditLog: {
      create: async () => {
        throw {
          code: 'P2022',
          message: 'The column `severity` does not exist in the current database.'
        };
      }
    },
    $executeRaw: async () => {
      fallbackCalls += 1;
      return 1;
    }
  };

  const result = await repository.create(
    {
      actorUserId: 'user_1',
      action: 'COMPANY_UPDATED'
    },
    fakeDb as never
  );

  assert.equal(result.persisted, true);
  assert.equal(result.fallbackUsed, true);
  assert.equal(fallbackCalls, 1);
});

test('AuditLogRepository.create is non-blocking when audit persistence fails', async () => {
  const repository = new AuditLogRepository();

  const fakeDb = {
    auditLog: {
      create: async () => {
        throw new Error('audit table temporarily unavailable');
      }
    },
    $executeRaw: async () => {
      throw new Error('legacy insert failed');
    }
  };

  const result = await repository.create(
    {
      actorUserId: 'user_1',
      action: 'SURVEY_CAMPAIGN_CREATED'
    },
    fakeDb as never
  );

  assert.equal(result.persisted, false);
  assert.equal(result.fallbackUsed, false);
  assert.match(result.errorMessage ?? '', /audit table temporarily unavailable/i);
});
