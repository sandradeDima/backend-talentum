import assert from 'node:assert/strict';
import test from 'node:test';
import { CompanyStatus } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { AuditLogRepository } from '../src/repositories/audit-log.repository';
import { CompanyService } from '../src/services/company.service';

test('CompanyService.createCompany preserves business flow when audit persistence fails', async () => {
  const createdCompany = {
    id: 'company_1',
    name: 'Acme SA',
    slug: 'acme-sa',
    logoUrl: null,
    workerCount: 25,
    contactEmail: 'ops@acme.test',
    status: CompanyStatus.PENDING_SETUP,
    createdByAdminId: 'admin_1',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z')
  };

  const companyRepository = {
    findBySlug: async () => null,
    create: async () => createdCompany
  };

  const service = new CompanyService(
    companyRepository as never,
    new AuditLogRepository()
  );

  const originalTransaction = prisma.$transaction;

  const fakeTx = {
    auditLog: {
      create: async () => {
        throw new Error('audit storage unavailable');
      }
    },
    $executeRaw: async () => {
      throw new Error('legacy audit insert unavailable');
    }
  };

  (prisma as unknown as { $transaction: typeof prisma.$transaction }).$transaction =
    (async (arg: unknown) => {
      if (typeof arg === 'function') {
        return (arg as (tx: unknown) => Promise<unknown>)(fakeTx);
      }

      throw new Error('Unexpected prisma.$transaction signature in test');
    }) as typeof prisma.$transaction;

  try {
    const result = await service.createCompany(
      {
        name: 'Acme SA',
        slug: 'acme-sa',
        workerCount: 25,
        contactEmail: 'ops@acme.test'
      },
      'admin_1'
    );

    assert.equal(result.company.id, createdCompany.id);
    assert.equal(result.company.slug, createdCompany.slug);
    assert.equal(result.company.status, CompanyStatus.PENDING_SETUP);
  } finally {
    (prisma as unknown as { $transaction: typeof prisma.$transaction }).$transaction =
      originalTransaction;
  }
});
