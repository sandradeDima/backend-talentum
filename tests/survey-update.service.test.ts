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
import type { UpdateSurveyCampaignDto } from '../src/dto/survey.dto';
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
    status: SurveyCampaignStatus.BORRADOR,
    startDate: new Date('2026-03-01T00:01:00.000Z'),
    endDate: new Date('2026-03-15T23:59:00.000Z'),
    initialSendScheduledAt: null,
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
    tutorialVideoUrl: null,
    reminders: [],
    reminderSchedules: [],
    createdAt: new Date('2026-02-10T00:00:00.000Z'),
    updatedAt: new Date('2026-02-10T00:00:00.000Z'),
    ...overrides
  }) as SurveyCampaignDetailRow;

const makeUpdateInput = (): UpdateSurveyCampaignDto => ({
  templateKey: SurveyTemplateKey.BASE_CLIMA_V1,
  name: 'Encuesta actualizada',
  startDate: '2026-03-01',
  endDate: '2026-03-20',
  introGeneral: 'Nueva intro',
  leaderIntro: 'Leader intro',
  leaderQuestions: ['L1'],
  leaderExtraQuestion: 'Pregunta extra lider',
  teamIntro: 'Team intro',
  teamQuestions: ['T1'],
  teamExtraQuestion: 'Pregunta extra equipo',
  organizationIntro: 'Org intro',
  organizationQuestions: ['O1'],
  organizationExtraQuestion: 'Pregunta extra org',
  finalNpsQuestion: 'NPS',
  finalOpenQuestion: 'Open',
  closingText: 'Gracias',
  tutorialVideoUrl: null
});

test('SurveyService.updateSurveyCampaign allows editing draft campaigns after start date', async () => {
  const startedDraftCampaign = makeCampaignRow({
    startDate: new Date('2026-01-01T00:01:00.000Z'),
    endDate: new Date('2099-12-31T23:59:00.000Z')
  });
  let updatePayload: Record<string, unknown> | null = null;

  const surveyRepository = {
    findByCompanyIdAndSlug: async () => startedDraftCampaign,
    updateById: async (campaignId: string, data: Record<string, unknown>) => {
      assert.equal(campaignId, startedDraftCampaign.id);
      updatePayload = data;
      return makeCampaignRow({
        ...startedDraftCampaign,
        ...data,
        name: String(data.name ?? startedDraftCampaign.name),
        startDate: (data.startDate as Date | undefined) ?? startedDraftCampaign.startDate,
        endDate: (data.endDate as Date | undefined) ?? startedDraftCampaign.endDate,
        updatedAt: new Date('2026-02-11T00:00:00.000Z')
      });
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

  const originalTransaction = prisma.$transaction;
  (prisma as unknown as { $transaction: typeof prisma.$transaction }).$transaction =
    (async (arg: unknown) => {
      if (typeof arg === 'function') {
        return (arg as (tx: unknown) => Promise<unknown>)({});
      }

      throw new Error('Unexpected prisma.$transaction signature in test');
    }) as typeof prisma.$transaction;

  try {
    const result = await service.updateSurveyCampaign(
      companyRow.slug,
      startedDraftCampaign.slug,
      makeUpdateInput(),
      adminPrincipal
    );

    assert.ok(updatePayload);
    assert.equal(result.status, SurveyCampaignStatus.BORRADOR);
    assert.equal(result.lifecycle.state, 'DRAFT');
    assert.equal(result.name, 'Encuesta actualizada');
  } finally {
    (prisma as unknown as { $transaction: typeof prisma.$transaction }).$transaction =
      originalTransaction;
  }
});

test('SurveyService.updateSurveyCampaign still blocks non-draft campaigns after start date', async () => {
  const startedScheduledCampaign = makeCampaignRow({
    status: SurveyCampaignStatus.CREADA,
    initialSendScheduledAt: new Date('2025-12-31T12:00:00.000Z'),
    startDate: new Date('2026-01-01T00:01:00.000Z'),
    endDate: new Date('2099-12-31T23:59:00.000Z')
  });
  let updateCalls = 0;

  const surveyRepository = {
    findByCompanyIdAndSlug: async () => startedScheduledCampaign,
    updateById: async () => {
      updateCalls += 1;
      return startedScheduledCampaign;
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
    service.updateSurveyCampaign(
      companyRow.slug,
      startedScheduledCampaign.slug,
      makeUpdateInput(),
      adminPrincipal
    ),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 409);
      assert.equal(error.mensajeTecnico, 'SURVEY_EDIT_WINDOW_CLOSED');
      return true;
    }
  );

  assert.equal(updateCalls, 0);
});
