import {
  ReminderDispatchStatus,
  ReminderScheduleStatus,
  Role,
  SurveyCampaignStatus,
  type SurveyTemplateKey
} from '@prisma/client';
import { AppError } from '../errors/appError';
import { deriveSurveyLifecycle, type SurveyLifecycle } from '../lib/survey-lifecycle';
import { prisma } from '../lib/prisma';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { CompanyRepository } from '../repositories/company.repository';
import {
  SurveyRepository,
  type GlobalSurveyCampaignSummaryRow,
  type SurveyCampaignDetailRow,
  type SurveyCampaignSummaryRow
} from '../repositories/survey.repository';
import type {
  ConfigureSurveyRemindersDto,
  CreateSurveyCampaignDto,
  ListGlobalSurveyCampaignsQueryDto,
  ScheduleSurveySendDto,
  UpdateSurveyCampaignDto
} from '../dto/survey.dto';
import type { SessionPrincipal } from '../types/auth';
import { normalizeSlug } from '../utils/slug';

type SurveyDetailResponse = {
  id: string;
  companyId: string;
  slug: string;
  name: string;
  templateKey: SurveyTemplateKey;
  status: SurveyCampaignStatus;
  createdAt: Date;
  updatedAt: Date;
  startDate: Date;
  endDate: Date;
  totalEnabledDays: number;
  initialSendScheduledAt: Date | null;
  remindersLockedAt: Date | null;
  remindersLocked: boolean;
  finalizedAt: Date | null;
  lifecycle: SurveyLifecycle;
  genericLinkPath: string;
  tutorialVideoUrl: string | null;
  content: {
    introGeneral: string;
    leaderIntro: string;
    leaderQuestions: string[];
    leaderExtraQuestion: string | null;
    teamIntro: string;
    teamQuestions: string[];
    teamExtraQuestion: string | null;
    organizationIntro: string;
    organizationQuestions: string[];
    organizationExtraQuestion: string | null;
    finalNpsQuestion: string;
    finalOpenQuestion: string;
    closingText: string;
  };
  reminders: Array<{
    id: string;
    scheduledAt: Date;
    createdAt: Date;
  }>;
  reminderSchedules: Array<{
    id: string;
    scheduledAt: Date;
    status: ReminderScheduleStatus;
    attemptCount: number;
    lastAttemptAt: Date | null;
    processedAt: Date | null;
    nextRetryAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    dispatchSummary: {
      total: number;
      pending: number;
      sent: number;
      failed: number;
      skipped: number;
    };
  }>;
};

type SurveySummaryResponse = {
  id: string;
  slug: string;
  name: string;
  templateKey: SurveyTemplateKey;
  status: SurveyCampaignStatus;
  createdAt: Date;
  startDate: Date;
  endDate: Date;
  totalEnabledDays: number;
  initialSendScheduledAt: Date | null;
  remindersLockedAt: Date | null;
  remindersLocked: boolean;
  finalizedAt: Date | null;
  lifecycle: SurveyLifecycle;
  genericLinkPath: string;
  tutorialVideoUrl: string | null;
};

type GlobalSurveySummaryResponse = SurveySummaryResponse & {
  company: {
    id: string;
    name: string;
    slug: string;
    status: 'PENDING_SETUP' | 'ACTIVE' | 'INACTIVE';
  };
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const isExactDateMatch = (
  date: Date,
  input: {
    year: number;
    month: number;
    day: number;
    hour?: number;
    minute?: number;
  }
) => {
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return (
    date.getFullYear() === input.year &&
    date.getMonth() === input.month - 1 &&
    date.getDate() === input.day &&
    (typeof input.hour === 'number' ? date.getHours() === input.hour : true) &&
    (typeof input.minute === 'number' ? date.getMinutes() === input.minute : true)
  );
};

const parseDateOnly = (input: string, mode: 'start' | 'end'): Date => {
  const [yearRaw, monthRaw, dayRaw] = input.split('-').map(Number);

  if (!yearRaw || !monthRaw || !dayRaw) {
    throw new AppError('Fecha inválida', 400, 'INVALID_SURVEY_DATE');
  }

  const date =
    mode === 'start'
      ? new Date(yearRaw, monthRaw - 1, dayRaw, 0, 1, 0, 0)
      : new Date(yearRaw, monthRaw - 1, dayRaw, 23, 59, 0, 0);

  if (!isExactDateMatch(date, { year: yearRaw, month: monthRaw, day: dayRaw })) {
    throw new AppError('Fecha inválida', 400, 'INVALID_SURVEY_DATE');
  }

  return date;
};

const parseDateTimeInput = (input: string): Date => {
  const localDateTimePattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
  const localMatch = input.match(localDateTimePattern);

  if (localMatch) {
    const [, year, month, day, hour, minute] = localMatch;
    const parsed = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      0,
      0
    );

    if (
      !isExactDateMatch(parsed, {
        year: Number(year),
        month: Number(month),
        day: Number(day),
        hour: Number(hour),
        minute: Number(minute)
      })
    ) {
      return new Date(Number.NaN);
    }

    return parsed;
  }

  const parsed = new Date(input);
  return parsed;
};

const normalizeOptionalQuestion = (value: string | null | undefined): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const toCalendarStart = (value: Date): Date => {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0, 0);
};

const calculateTotalEnabledDays = (startDate: Date, endDate: Date): number => {
  const start = toCalendarStart(startDate);
  const end = toCalendarStart(endDate);
  return Math.floor((end.getTime() - start.getTime()) / DAY_IN_MS) + 1;
};

const isValidDateValue = (value: Date): boolean => !Number.isNaN(value.getTime());

const makeDefaultDispatchSummary = () => ({
  total: 0,
  pending: 0,
  sent: 0,
  failed: 0,
  skipped: 0
});

const ensureDateWindow = (startDate: Date, endDate: Date) => {
  if (!isValidDateValue(startDate) || !isValidDateValue(endDate)) {
    throw new AppError('Fechas inválidas', 400, 'INVALID_SURVEY_DATE');
  }

  if (endDate.getTime() < startDate.getTime()) {
    throw new AppError(
      'La fecha fin debe ser igual o posterior a la fecha inicial',
      400,
      'SURVEY_DATE_RANGE_INVALID'
    );
  }
};

const buildGenericLinkPath = (campaignSlug: string) => `/survey/${campaignSlug}`;

const assertSlugParam = (rawSlug: string, code: string): string => {
  const slug = normalizeSlug(rawSlug);

  if (!slug || slug.length < 2) {
    throw new AppError('Slug inválido', 400, code);
  }

  return slug;
};

const parseQuestionArray = (value: unknown, field: string): string[] => {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw new AppError('Formato de preguntas inválido', 500, `INVALID_SURVEY_FIELD_${field}`);
  }

  return value;
};

export class SurveyService {
  constructor(
    private readonly surveyRepository: SurveyRepository,
    private readonly companyRepository: CompanyRepository,
    private readonly auditLogRepository: AuditLogRepository
  ) {}

  private assertAdmin(principal: SessionPrincipal) {
    if (principal.role !== Role.ADMIN) {
      throw new AppError(
        'Solo ADMIN puede gestionar encuestas en esta etapa',
        403,
        'SURVEY_ADMIN_REQUIRED'
      );
    }
  }

  private async resolveCompanyBySlug(companySlug: string, principal: SessionPrincipal) {
    const slug = assertSlugParam(companySlug, 'INVALID_COMPANY_SLUG_PARAM');
    const company = await this.companyRepository.findBySlugForAdmin(slug);

    if (!company) {
      throw new AppError('Empresa no encontrada', 404, 'COMPANY_NOT_FOUND');
    }

    if (principal.role === Role.CLIENT_ADMIN && principal.companyId !== company.id) {
      throw new AppError('Acceso denegado a esta empresa', 403, 'COMPANY_SCOPE_FORBIDDEN');
    }

    return company;
  }

  private deriveStatus(input: {
    startDate: Date;
    endDate: Date;
    initialSendScheduledAt: Date | null;
  }): SurveyCampaignStatus {
    if (!input.initialSendScheduledAt) {
      return SurveyCampaignStatus.BORRADOR;
    }

    const now = Date.now();

    if (now > input.endDate.getTime()) {
      return SurveyCampaignStatus.FINALIZADA;
    }

    if (now >= input.startDate.getTime() && now <= input.endDate.getTime()) {
      return SurveyCampaignStatus.EN_PROCESO;
    }

    return SurveyCampaignStatus.CREADA;
  }

  private serializeSummary(row: SurveyCampaignSummaryRow): SurveySummaryResponse {
    const lifecycle = deriveSurveyLifecycle({
      status: row.status,
      startDate: row.startDate,
      endDate: row.endDate,
      initialSendScheduledAt: row.initialSendScheduledAt,
      remindersLockedAt: row.remindersLockedAt
    });

    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      templateKey: row.templateKey,
      status: this.deriveStatus({
        startDate: row.startDate,
        endDate: row.endDate,
        initialSendScheduledAt: row.initialSendScheduledAt
      }),
      createdAt: row.createdAt,
      startDate: row.startDate,
      endDate: row.endDate,
      totalEnabledDays: calculateTotalEnabledDays(row.startDate, row.endDate),
      initialSendScheduledAt: row.initialSendScheduledAt,
      remindersLockedAt: row.remindersLockedAt,
      remindersLocked: Boolean(row.remindersLockedAt),
      finalizedAt: row.finalizedAt,
      lifecycle,
      genericLinkPath: buildGenericLinkPath(row.slug),
      tutorialVideoUrl: row.tutorialVideoUrl
    };
  }

  private serializeGlobalSummary(
    row: GlobalSurveyCampaignSummaryRow
  ): GlobalSurveySummaryResponse {
    return {
      ...this.serializeSummary(row),
      company: {
        id: row.company.id,
        name: row.company.name,
        slug: row.company.slug,
        status: row.company.status
      }
    };
  }

  private async buildDispatchSummaryByScheduleId(scheduleIds: string[]) {
    if (scheduleIds.length === 0) {
      return new Map<string, ReturnType<typeof makeDefaultDispatchSummary>>();
    }

    const grouped = await prisma.reminderDispatch.groupBy({
      by: ['reminderScheduleId', 'status'],
      where: {
        reminderScheduleId: {
          in: scheduleIds
        }
      },
      _count: {
        _all: true
      }
    });

    const summaryByScheduleId = new Map<
      string,
      ReturnType<typeof makeDefaultDispatchSummary>
    >();

    for (const row of grouped) {
      const current =
        summaryByScheduleId.get(row.reminderScheduleId) ?? makeDefaultDispatchSummary();
      const count = row._count._all;

      if (row.status === ReminderDispatchStatus.PENDING) {
        current.pending += count;
      } else if (row.status === ReminderDispatchStatus.SENT) {
        current.sent += count;
      } else if (row.status === ReminderDispatchStatus.FAILED) {
        current.failed += count;
      } else if (row.status === ReminderDispatchStatus.SKIPPED) {
        current.skipped += count;
      }

      current.total += count;
      summaryByScheduleId.set(row.reminderScheduleId, current);
    }

    return summaryByScheduleId;
  }

  private async serializeDetail(row: SurveyCampaignDetailRow): Promise<SurveyDetailResponse> {
    const reminderScheduleIds = row.reminderSchedules.map((item) => item.id);
    const dispatchSummaryByScheduleId = await this.buildDispatchSummaryByScheduleId(
      reminderScheduleIds
    );

    return {
      ...this.serializeSummary(row),
      companyId: row.companyId,
      updatedAt: row.updatedAt,
      content: {
        introGeneral: row.introGeneral,
        leaderIntro: row.leaderIntro,
        leaderQuestions: parseQuestionArray(row.leaderQuestions, 'leaderQuestions'),
        leaderExtraQuestion: row.leaderExtraQuestion,
        teamIntro: row.teamIntro,
        teamQuestions: parseQuestionArray(row.teamQuestions, 'teamQuestions'),
        teamExtraQuestion: row.teamExtraQuestion,
        organizationIntro: row.organizationIntro,
        organizationQuestions: parseQuestionArray(
          row.organizationQuestions,
          'organizationQuestions'
        ),
        organizationExtraQuestion: row.organizationExtraQuestion,
        finalNpsQuestion: row.finalNpsQuestion,
        finalOpenQuestion: row.finalOpenQuestion,
        closingText: row.closingText
      },
      reminders: row.reminders,
      reminderSchedules: row.reminderSchedules.map((schedule) => ({
        id: schedule.id,
        scheduledAt: schedule.scheduledAt,
        status: schedule.status,
        attemptCount: schedule.attemptCount,
        lastAttemptAt: schedule.lastAttemptAt,
        processedAt: schedule.processedAt,
        nextRetryAt: schedule.nextRetryAt,
        createdAt: schedule.createdAt,
        updatedAt: schedule.updatedAt,
        dispatchSummary:
          dispatchSummaryByScheduleId.get(schedule.id) ?? makeDefaultDispatchSummary()
      }))
    };
  }

  private async generateUniqueCampaignSlug(companySlug: string, campaignName: string) {
    const normalizedCompanySlug = normalizeSlug(companySlug) || 'empresa';
    const normalizedName = normalizeSlug(campaignName) || 'encuesta';
    const base = normalizeSlug(`${normalizedCompanySlug}-${normalizedName}`) || 'encuesta';

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const suffix = attempt === 0 ? '' : `-${Math.random().toString(36).slice(2, 6)}`;
      const candidate = `${base}${suffix}`.slice(0, 80).replace(/-+$/g, '');

      if (!candidate) {
        continue;
      }

      const existing = await this.surveyRepository.findBySlug(candidate);
      if (!existing) {
        return candidate;
      }
    }

    throw new AppError(
      'No se pudo generar un slug único para la encuesta',
      409,
      'SURVEY_CAMPAIGN_SLUG_GENERATION_FAILED'
    );
  }

  private async resolveCampaignBySlug(
    companyId: string,
    surveySlug: string
  ): Promise<SurveyCampaignDetailRow> {
    const slug = assertSlugParam(surveySlug, 'INVALID_SURVEY_SLUG_PARAM');
    const campaign = await this.surveyRepository.findByCompanyIdAndSlug(companyId, slug);

    if (!campaign) {
      throw new AppError('Encuesta no encontrada', 404, 'SURVEY_CAMPAIGN_NOT_FOUND');
    }

    return campaign;
  }

  private ensureSurveyEditable(campaign: SurveyCampaignDetailRow) {
    if (Date.now() >= campaign.startDate.getTime()) {
      throw new AppError(
        'La encuesta ya inició y no admite más cambios de configuración',
        409,
        'SURVEY_EDIT_WINDOW_CLOSED'
      );
    }
  }

  private assertExtraQuestionsCanBeUpdated(
    campaign: SurveyCampaignDetailRow,
    input: UpdateSurveyCampaignDto
  ) {
    // Business-safe rule: extra questions are editable only while the campaign
    // remains in BORRADOR. Once it is scheduled (or beyond), they are locked.
    const currentStatus = this.deriveStatus({
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      initialSendScheduledAt: campaign.initialSendScheduledAt
    });

    if (currentStatus === SurveyCampaignStatus.BORRADOR) {
      return;
    }

    const changed =
      normalizeOptionalQuestion(input.leaderExtraQuestion) !== campaign.leaderExtraQuestion ||
      normalizeOptionalQuestion(input.teamExtraQuestion) !== campaign.teamExtraQuestion ||
      normalizeOptionalQuestion(input.organizationExtraQuestion) !==
        campaign.organizationExtraQuestion;

    if (changed) {
      throw new AppError(
        'Las preguntas opcionales no se pueden modificar fuera de BORRADOR',
        409,
        'SURVEY_EXTRA_QUESTIONS_LOCKED'
      );
    }
  }

  async listByCompanySlug(companySlug: string, principal: SessionPrincipal) {
    const company = await this.resolveCompanyBySlug(companySlug, principal);
    const rows = await this.surveyRepository.listByCompanyId(company.id);

    return {
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug
      },
      rows: rows.map((row) => this.serializeSummary(row))
    };
  }

  async listGlobalSurveys(
    query: ListGlobalSurveyCampaignsQueryDto,
    principal: SessionPrincipal
  ) {
    this.assertAdmin(principal);

    const result = await this.surveyRepository.listGlobalWithFilters({
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
      company: query.company,
      status: query.status
    });

    return {
      rows: result.rows.map((row) => this.serializeGlobalSummary(row)),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / query.pageSize))
      }
    };
  }

  async createSurveyCampaign(
    companySlug: string,
    input: CreateSurveyCampaignDto,
    principal: SessionPrincipal
  ) {
    this.assertAdmin(principal);

    const company = await this.resolveCompanyBySlug(companySlug, principal);
    const startDate = parseDateOnly(input.startDate, 'start');
    const endDate = parseDateOnly(input.endDate, 'end');

    ensureDateWindow(startDate, endDate);

    const slug = await this.generateUniqueCampaignSlug(company.slug, input.name);

    const created = await prisma.$transaction(async (tx) => {
      const campaign = await this.surveyRepository.create(
        {
          companyId: company.id,
          slug,
          name: input.name.trim(),
          templateKey: input.templateKey,
          status: SurveyCampaignStatus.BORRADOR,
          createdByAdminId: principal.id,
          startDate,
          endDate,
          introGeneral: input.introGeneral.trim(),
          leaderIntro: input.leaderIntro.trim(),
          leaderQuestions: input.leaderQuestions.map((question) => question.trim()),
          leaderExtraQuestion: normalizeOptionalQuestion(input.leaderExtraQuestion),
          teamIntro: input.teamIntro.trim(),
          teamQuestions: input.teamQuestions.map((question) => question.trim()),
          teamExtraQuestion: normalizeOptionalQuestion(input.teamExtraQuestion),
          organizationIntro: input.organizationIntro.trim(),
          organizationQuestions: input.organizationQuestions.map((question) => question.trim()),
          organizationExtraQuestion: normalizeOptionalQuestion(
            input.organizationExtraQuestion
          ),
          finalNpsQuestion: input.finalNpsQuestion.trim(),
          finalOpenQuestion: input.finalOpenQuestion.trim(),
          closingText: input.closingText.trim(),
          tutorialVideoUrl: input.tutorialVideoUrl?.trim() || null
        },
        tx
      );

      await this.auditLogRepository.create(
        {
          actorUserId: principal.id,
          action: 'SURVEY_CAMPAIGN_CREATED',
          companyId: company.id,
          targetType: 'SURVEY_CAMPAIGN',
          targetId: campaign.id,
          metadata: {
            surveySlug: campaign.slug,
            templateKey: campaign.templateKey
          }
        },
        tx
      );

      return campaign;
    });

    return this.serializeDetail(created);
  }

  async getSurveyCampaign(
    companySlug: string,
    surveySlug: string,
    principal: SessionPrincipal
  ) {
    const company = await this.resolveCompanyBySlug(companySlug, principal);
    const campaign = await this.resolveCampaignBySlug(company.id, surveySlug);
    return this.serializeDetail(campaign);
  }

  async updateSurveyCampaign(
    companySlug: string,
    surveySlug: string,
    input: UpdateSurveyCampaignDto,
    principal: SessionPrincipal
  ) {
    this.assertAdmin(principal);

    const company = await this.resolveCompanyBySlug(companySlug, principal);
    const campaign = await this.resolveCampaignBySlug(company.id, surveySlug);

    this.ensureSurveyEditable(campaign);
    this.assertExtraQuestionsCanBeUpdated(campaign, input);

    const nextStartDate = parseDateOnly(input.startDate, 'start');
    const nextEndDate = parseDateOnly(input.endDate, 'end');

    ensureDateWindow(nextStartDate, nextEndDate);

    const initialSendInvalidated =
      campaign.initialSendScheduledAt !== null &&
      campaign.initialSendScheduledAt.getTime() > nextStartDate.getTime();

    const nextInitialSendScheduledAt = initialSendInvalidated
      ? null
      : campaign.initialSendScheduledAt;

    const updated = await prisma.$transaction(async (tx) => {
      const nextStatus = this.deriveStatus({
        startDate: nextStartDate,
        endDate: nextEndDate,
        initialSendScheduledAt: nextInitialSendScheduledAt
      });

      const result = await this.surveyRepository.updateById(
        campaign.id,
        {
          name: input.name.trim(),
          templateKey: input.templateKey,
          status: nextStatus,
          startDate: nextStartDate,
          endDate: nextEndDate,
          initialSendScheduledAt: nextInitialSendScheduledAt,
          introGeneral: input.introGeneral.trim(),
          leaderIntro: input.leaderIntro.trim(),
          leaderQuestions: input.leaderQuestions.map((question) => question.trim()),
          leaderExtraQuestion: normalizeOptionalQuestion(input.leaderExtraQuestion),
          teamIntro: input.teamIntro.trim(),
          teamQuestions: input.teamQuestions.map((question) => question.trim()),
          teamExtraQuestion: normalizeOptionalQuestion(input.teamExtraQuestion),
          organizationIntro: input.organizationIntro.trim(),
          organizationQuestions: input.organizationQuestions.map((question) => question.trim()),
          organizationExtraQuestion: normalizeOptionalQuestion(
            input.organizationExtraQuestion
          ),
          finalNpsQuestion: input.finalNpsQuestion.trim(),
          finalOpenQuestion: input.finalOpenQuestion.trim(),
          closingText: input.closingText.trim(),
          tutorialVideoUrl: input.tutorialVideoUrl?.trim() || null
        },
        tx
      );

      await this.auditLogRepository.create(
        {
          actorUserId: principal.id,
          action: 'SURVEY_CAMPAIGN_UPDATED',
          companyId: company.id,
          targetType: 'SURVEY_CAMPAIGN',
          targetId: result.id,
          metadata: {
            surveySlug: result.slug,
            ...(initialSendInvalidated && { initialSendCleared: true })
          }
        },
        tx
      );

      return result;
    });

    return this.serializeDetail(updated);
  }

  async scheduleInitialSend(
    companySlug: string,
    surveySlug: string,
    input: ScheduleSurveySendDto,
    principal: SessionPrincipal
  ) {
    this.assertAdmin(principal);

    const company = await this.resolveCompanyBySlug(companySlug, principal);
    const campaign = await this.resolveCampaignBySlug(company.id, surveySlug);
    const activeParticipants = await prisma.respondent.count({
      where: {
        surveyCampaignId: campaign.id,
        isActive: true
      }
    });

    if (activeParticipants === 0) {
      throw new AppError(
        'Debes importar al menos un participante antes de programar el envío inicial',
        409,
        'SURVEY_PARTICIPANTS_REQUIRED_BEFORE_INITIAL_SEND'
      );
    }

    const lifecycle = deriveSurveyLifecycle(campaign);

    if (!lifecycle.canScheduleInitialSend) {
      throw new AppError(
        'La encuesta ya fue programada y no puede reprogramarse en este estado',
        409,
        'SURVEY_ALREADY_SCHEDULED'
      );
    }

    const startDatePassed = Date.now() >= campaign.startDate.getTime();

    let scheduledAt: Date;

    if (startDatePassed) {
      // Retroactive activation: start date already passed, use it as the scheduled time
      scheduledAt = campaign.startDate;
    } else {
      const parsed = parseDateTimeInput(input.scheduledAt);

      if (!isValidDateValue(parsed)) {
        throw new AppError('Fecha y hora de envío inválidas', 400, 'INVALID_SURVEY_SEND_SCHEDULE');
      }

      if (parsed.getTime() <= Date.now()) {
        throw new AppError(
          'El envío inicial debe programarse en una fecha y hora futura',
          400,
          'SURVEY_SEND_MUST_BE_FUTURE'
        );
      }

      if (parsed.getTime() > campaign.startDate.getTime()) {
        throw new AppError(
          'El envío inicial debe programarse antes del inicio de la encuesta',
          400,
          'SURVEY_SEND_AFTER_START'
        );
      }

      scheduledAt = parsed;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await this.surveyRepository.updateById(
        campaign.id,
        {
          initialSendScheduledAt: scheduledAt,
          status: SurveyCampaignStatus.CREADA
        },
        tx
      );

      await this.auditLogRepository.create(
        {
          actorUserId: principal.id,
          action: 'SURVEY_INITIAL_SEND_SCHEDULED',
          companyId: company.id,
          targetType: 'SURVEY_CAMPAIGN',
          targetId: result.id,
          metadata: {
            scheduledAt
          }
        },
        tx
      );

      return result;
    });

    return this.serializeDetail(updated);
  }

  async closeSurveyCampaign(
    companySlug: string,
    surveySlug: string,
    principal: SessionPrincipal
  ) {
    this.assertAdmin(principal);

    const company = await this.resolveCompanyBySlug(companySlug, principal);
    const campaign = await this.resolveCampaignBySlug(company.id, surveySlug);
    const lifecycle = deriveSurveyLifecycle({
      status: campaign.status,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      initialSendScheduledAt: campaign.initialSendScheduledAt,
      remindersLockedAt: campaign.remindersLockedAt
    });

    if (lifecycle.state === 'FINALIZED') {
      throw new AppError('La encuesta ya fue finalizada', 409, 'SURVEY_ALREADY_FINALIZED');
    }

    if (lifecycle.state === 'DRAFT') {
      throw new AppError(
        'Debes programar el envío inicial antes de cerrar la encuesta',
        409,
        'SURVEY_INITIAL_SEND_REQUIRED'
      );
    }

    if (lifecycle.state === 'SCHEDULED') {
      throw new AppError(
        'La encuesta aún no inició. Solo puedes cerrarla cuando esté activa',
        409,
        'SURVEY_CLOSE_REQUIRES_ACTIVE'
      );
    }

    if (lifecycle.state === 'CLOSED') {
      return this.serializeDetail(campaign);
    }

    const closedAt = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const result = await this.surveyRepository.updateById(
        campaign.id,
        {
          endDate: closedAt
        },
        tx
      );

      await this.auditLogRepository.create(
        {
          actorUserId: principal.id,
          action: 'SURVEY_CAMPAIGN_CLOSED',
          companyId: company.id,
          targetType: 'SURVEY_CAMPAIGN',
          targetId: result.id,
          metadata: {
            closedAt
          }
        },
        tx
      );

      return result;
    });

    return this.serializeDetail(updated);
  }

  async finalizeSurveyCampaign(
    companySlug: string,
    surveySlug: string,
    principal: SessionPrincipal
  ) {
    this.assertAdmin(principal);

    const company = await this.resolveCompanyBySlug(companySlug, principal);
    const campaign = await this.resolveCampaignBySlug(company.id, surveySlug);
    const lifecycle = deriveSurveyLifecycle({
      status: campaign.status,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      initialSendScheduledAt: campaign.initialSendScheduledAt,
      remindersLockedAt: campaign.remindersLockedAt
    });

    if (lifecycle.state === 'FINALIZED') {
      return this.serializeDetail(campaign);
    }

    if (lifecycle.state !== 'CLOSED') {
      throw new AppError(
        'Debes cerrar la encuesta antes de finalizarla',
        409,
        'SURVEY_FINALIZE_REQUIRES_CLOSED'
      );
    }

    const finalizedAt = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const result = await this.surveyRepository.updateById(
        campaign.id,
        {
          status: SurveyCampaignStatus.FINALIZADA,
          finalizedAt
        },
        tx
      );

      await this.auditLogRepository.create(
        {
          actorUserId: principal.id,
          action: 'SURVEY_CAMPAIGN_FINALIZED',
          companyId: company.id,
          targetType: 'SURVEY_CAMPAIGN',
          targetId: result.id,
          metadata: {
            finalizedAt
          }
        },
        tx
      );

      return result;
    });

    return this.serializeDetail(updated);
  }

  async configureReminders(
    companySlug: string,
    surveySlug: string,
    input: ConfigureSurveyRemindersDto,
    principal: SessionPrincipal
  ) {
    this.assertAdmin(principal);

    const company = await this.resolveCompanyBySlug(companySlug, principal);
    const campaign = await this.resolveCampaignBySlug(company.id, surveySlug);

    if (!campaign.initialSendScheduledAt) {
      throw new AppError(
        'Debes programar el envío inicial antes de configurar recordatorios',
        409,
        'SURVEY_INITIAL_SEND_REQUIRED'
      );
    }

    if (Date.now() > campaign.endDate.getTime()) {
      throw new AppError(
        'La encuesta ya finalizó y no admite nuevos recordatorios',
        409,
        'SURVEY_ALREADY_FINISHED'
      );
    }

    const scheduledAtValues = input.reminders
      .map((reminder) => parseDateTimeInput(reminder.scheduledAt))
      .map((date) => {
        if (!isValidDateValue(date)) {
          throw new AppError('Una de las fechas de recordatorio es inválida', 400, 'INVALID_REMINDER_DATE');
        }

        if (date.getTime() < campaign.startDate.getTime()) {
          throw new AppError(
            'Los recordatorios deben programarse dentro del periodo activo de la encuesta',
            400,
            'REMINDER_BEFORE_SURVEY_WINDOW'
          );
        }

        if (date.getTime() > campaign.endDate.getTime()) {
          throw new AppError(
            'Los recordatorios deben programarse dentro del periodo activo de la encuesta',
            400,
            'REMINDER_AFTER_SURVEY_WINDOW'
          );
        }

        if (date.getTime() <= Date.now()) {
          throw new AppError(
            'Los recordatorios deben programarse en fechas futuras',
            400,
            'REMINDER_MUST_BE_FUTURE'
          );
        }

        return date;
      })
      .sort((a, b) => a.getTime() - b.getTime());

    const deduplicated = scheduledAtValues.filter(
      (value, index, source) =>
        index === 0 || value.getTime() !== source[index - 1]?.getTime()
    );

    const updated = await prisma.$transaction(async (tx) => {
      const now = new Date();

      await tx.surveyReminder.deleteMany({
        where: {
          surveyCampaignId: campaign.id,
          scheduledAt: {
            gt: now
          }
        }
      });

      await tx.surveyReminder.createMany({
        data: deduplicated.map((scheduledAt) => ({
          surveyCampaignId: campaign.id,
          scheduledAt,
          targetNotStarted: true,
          targetNotFinished: true
        }))
      });

      await tx.reminderSchedule.deleteMany({
        where: {
          surveyCampaignId: campaign.id,
          scheduledAt: {
            gt: now
          }
        }
      });

      await tx.reminderSchedule.createMany({
        data: deduplicated.map((scheduledAt) => ({
          surveyCampaignId: campaign.id,
          scheduledAt,
          status: ReminderScheduleStatus.PENDING,
          createdByUserId: principal.id
        }))
      });

      const result = await this.surveyRepository.updateById(
        campaign.id,
        {
          remindersLockedAt: null
        },
        tx
      );

      await this.auditLogRepository.create(
        {
          actorUserId: principal.id,
          action: 'SURVEY_REMINDERS_CONFIGURED',
          companyId: company.id,
          targetType: 'SURVEY_CAMPAIGN',
          targetId: result.id,
          metadata: {
            remindersCount: deduplicated.length,
            preservedPastSchedules: true
          }
        },
        tx
      );

      return result;
    });

    return this.serializeDetail(updated);
  }
}
