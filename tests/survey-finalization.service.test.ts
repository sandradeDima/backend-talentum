import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CompanyStatus,
  Role,
  SurveyCampaignStatus,
  SurveyTemplateKey
} from '@prisma/client';
import { AppError } from '../src/errors/appError';
import { prisma } from '../src/lib/prisma';
import type { SurveyCampaignDetailRow } from '../src/repositories/survey.repository';
import { SurveyService } from '../src/services/survey.service';
import type { SessionPrincipal } from '../src/types/auth';

const adminPrincipal: SessionPrincipal = {
  id: 'admin_1',
  email: 'admin@talentum.test',
  name: 'Admin',
  role: Role.ADMIN,
  companyId: null,
  companySlug: null,
  isActive: true
};

const companyRow = {
  id: 'company_1',
  name: 'Empresa Uno',
  slug: 'empresa-uno',
  workerCount: 120,
  contactEmail: 'rrhh@empresa-uno.test',
  status: CompanyStatus.ACTIVE,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  logoUrl: null
};

const makeCampaignRow = (
  overrides: Partial<SurveyCampaignDetailRow> = {}
): SurveyCampaignDetailRow =>
  ({
    id: 'survey_1',
    companyId: companyRow.id,
    slug: 'encuesta-clima',
    name: 'Encuesta de clima',
    templateKey: SurveyTemplateKey.BASE_CLIMA_V1,
    status: SurveyCampaignStatus.CREADA,
    startDate: new Date('2026-03-01T00:01:00.000Z'),
    endDate: new Date('2026-03-15T23:59:00.000Z'),
    initialSendScheduledAt: new Date('2026-02-28T12:00:00.000Z'),
    remindersLockedAt: null,
    finalizedAt: null,
    introGeneral: 'intro',
    leaderIntro: 'leader intro',
    leaderQuestions: ['q1'],
    leaderExtraQuestion: null,
    teamIntro: 'team intro',
    teamQuestions: ['q2'],
    teamExtraQuestion: null,
    organizationIntro: 'org intro',
    organizationQuestions: ['q3'],
    organizationExtraQuestion: null,
    finalNpsQuestion: 'nps',
    finalOpenQuestion: 'open',
    closingText: 'gracias',
    reminders: [],
    reminderSchedules: [],
    createdAt: new Date('2026-02-10T00:00:00.000Z'),
    updatedAt: new Date('2026-02-10T00:00:00.000Z'),
    ...overrides
  }) as SurveyCampaignDetailRow;

test('SurveyService.finalizeSurveyCampaign requires campaign to be closed first', async () => {
  const activeCampaign = makeCampaignRow({
    startDate: new Date('2026-04-01T00:01:00.000Z'),
    endDate: new Date('2099-12-31T23:59:00.000Z')
  });
  let updateCalls = 0;

  const surveyRepository = {
    findByCompanyIdAndSlug: async () => activeCampaign,
    updateById: async () => {
      updateCalls += 1;
      return activeCampaign;
    }
  };
  const companyRepository = {
    findBySlugForAdmin: async () => companyRow
  };
  const auditLogRepository = {
    create: async () => ({ persisted: true, fallbackUsed: false })
  };

  const service = new SurveyService(
    surveyRepository as never,
    companyRepository as never,
    auditLogRepository as never
  );

  await assert.rejects(
    service.finalizeSurveyCampaign(companyRow.slug, activeCampaign.slug, adminPrincipal),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 409);
      assert.equal(error.mensajeTecnico, 'SURVEY_FINALIZE_REQUIRES_CLOSED');
      return true;
    }
  );

  assert.equal(updateCalls, 0);
});

test('SurveyService.finalizeSurveyCampaign persists FINALIZADA status and finalizedAt timestamp', async () => {
  const closedCampaign = makeCampaignRow({
    status: SurveyCampaignStatus.CREADA,
    startDate: new Date('2026-02-01T00:01:00.000Z'),
    endDate: new Date('2026-02-15T23:59:00.000Z')
  });
  let updateInput: { status?: SurveyCampaignStatus; finalizedAt?: Date } | null = null;
  const auditActions: string[] = [];

  const surveyRepository = {
    findByCompanyIdAndSlug: async () => closedCampaign,
    updateById: async (
      campaignId: string,
      data: { status?: SurveyCampaignStatus; finalizedAt?: Date }
    ) => {
      assert.equal(campaignId, closedCampaign.id);
      updateInput = data;
      return makeCampaignRow({
        ...closedCampaign,
        status: SurveyCampaignStatus.FINALIZADA,
        finalizedAt: data.finalizedAt ?? null
      });
    }
  };
  const companyRepository = {
    findBySlugForAdmin: async () => companyRow
  };
  const auditLogRepository = {
    create: async (payload: { action?: string }) => {
      auditActions.push(payload.action ?? '');
      return { persisted: true, fallbackUsed: false };
    }
  };

  const service = new SurveyService(
    surveyRepository as never,
    companyRepository as never,
    auditLogRepository as never
  );

  const originalTransaction = prisma.$transaction;
  (prisma as unknown as { $transaction: typeof prisma.$transaction }).$transaction =
    (async (arg: unknown) => {
      if (typeof arg === 'function') {
        return (arg as (tx: unknown) => Promise<unknown>)({});
      }

      throw new Error('Unexpected prisma.$transaction signature in test');
    }) as typeof prisma.$transaction;

  try {
    const result = await service.finalizeSurveyCampaign(
      companyRow.slug,
      closedCampaign.slug,
      adminPrincipal
    );

    assert.ok(updateInput);
    assert.equal(updateInput?.status, SurveyCampaignStatus.FINALIZADA);
    assert.ok(updateInput?.finalizedAt instanceof Date);
    assert.equal(result.lifecycle.state, 'FINALIZED');
    assert.equal(result.status, SurveyCampaignStatus.FINALIZADA);
    assert.ok(result.finalizedAt instanceof Date);
    assert.deepEqual(auditActions, ['SURVEY_CAMPAIGN_FINALIZED']);
  } finally {
    (prisma as unknown as { $transaction: typeof prisma.$transaction }).$transaction =
      originalTransaction;
  }
});

test('SurveyService.finalizeSurveyCampaign is idempotent for already finalized campaigns', async () => {
  const alreadyFinalizedAt = new Date('2026-02-20T12:00:00.000Z');
  const finalizedCampaign = makeCampaignRow({
    status: SurveyCampaignStatus.FINALIZADA,
    finalizedAt: alreadyFinalizedAt,
    startDate: new Date('2026-02-01T00:01:00.000Z'),
    endDate: new Date('2026-02-15T23:59:00.000Z')
  });
  let updateCalls = 0;
  let auditCalls = 0;

  const surveyRepository = {
    findByCompanyIdAndSlug: async () => finalizedCampaign,
    updateById: async () => {
      updateCalls += 1;
      return finalizedCampaign;
    }
  };
  const companyRepository = {
    findBySlugForAdmin: async () => companyRow
  };
  const auditLogRepository = {
    create: async () => {
      auditCalls += 1;
      return { persisted: true, fallbackUsed: false };
    }
  };

  const service = new SurveyService(
    surveyRepository as never,
    companyRepository as never,
    auditLogRepository as never
  );

  const result = await service.finalizeSurveyCampaign(
    companyRow.slug,
    finalizedCampaign.slug,
    adminPrincipal
  );

  assert.equal(updateCalls, 0);
  assert.equal(auditCalls, 0);
  assert.equal(result.lifecycle.state, 'FINALIZED');
  assert.equal(result.finalizedAt?.toISOString(), alreadyFinalizedAt.toISOString());
});
