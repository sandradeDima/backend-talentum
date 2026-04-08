import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import {
  DashboardExportJobStatus,
  DashboardGroupBy,
  Role,
  SurveyCampaignStatus,
  Prisma
} from '@prisma/client';
import * as XLSX from 'xlsx';
import { env } from '../config/env';
import type {
  CreateDashboardExportJobDto,
  ListDashboardExportJobsQueryDto,
  DashboardProgressQueryDto,
  DashboardResultsQueryDto
} from '../dto/dashboard.dto';
import { AppError } from '../errors/appError';
import { prisma } from '../lib/prisma';
import { assertPrincipalRole, rolePolicy } from '../lib/role-policy';
import type { SessionPrincipal } from '../types/auth';
import { normalizeSlug } from '../utils/slug';

const DASHBOARD_ANONYMITY_MIN_COUNT = env.DASHBOARD_ANONYMITY_MIN_COUNT;
const DASHBOARD_EXPORT_SUPPORTED_FORMATS = ['XLSX'] as const;
const DASHBOARD_EXPORT_FORMAT = DASHBOARD_EXPORT_SUPPORTED_FORMATS[0];
const DASHBOARD_EXPORT_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

type CampaignScope = {
  id: string;
  slug: string;
  name: string;
  status: SurveyCampaignStatus;
  startDate: Date;
  endDate: Date;
  company: {
    id: string;
    name: string;
    slug: string;
  };
};

type ProgressRawRow = {
  groupKey: string | null;
  groupLabel: string | null;
  totalRespondents: number | bigint | string | null;
  startedRespondents: number | bigint | string | null;
  submittedRespondents: number | bigint | string | null;
};

type ResultOverallRawRow = {
  groupKey: string | null;
  groupLabel: string | null;
  submittedRespondents: number | bigint | string | null;
  answerCount: number | bigint | string | null;
  averageScore: number | string | null;
};

type ResultSectionRawRow = {
  groupKey: string | null;
  sectionKey: string | null;
  answerCount: number | bigint | string | null;
  averageScore: number | string | null;
};

type ResultQuestionRawRow = {
  groupKey: string | null;
  sectionKey: string | null;
  questionKey: string | null;
  answerCount: number | bigint | string | null;
  averageScore: number | string | null;
};

type DashboardProgressFetchResult = {
  rows: Array<{
    groupKey: string;
    groupLabel: string;
    totalRespondents: number;
    startedRespondents: number;
    submittedRespondents: number;
    completionRate: number;
  }>;
  eligibleGroupKeys: Set<string>;
  suppressedGroups: number;
  aggregateVisible: boolean;
  aggregateTotals: {
    totalRespondents: number;
    startedRespondents: number;
    submittedRespondents: number;
    completionRate: number;
  };
};

type DashboardResultsFetchResult = {
  overall: Array<{
    groupKey: string;
    groupLabel: string;
    submittedRespondents: number;
    answerCount: number;
    averageScore: number;
  }>;
  sections: Array<{
    groupKey: string;
    sectionKey: string;
    answerCount: number;
    averageScore: number;
  }>;
  questions: Array<{
    groupKey: string;
    sectionKey: string;
    questionKey: string;
    answerCount: number;
    averageScore: number;
  }>;
};

const toNumber = (value: unknown): number => {
  if (typeof value === 'bigint') {
    return Number(value);
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
};

const toNullableString = (value: string | null | undefined): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const numericAnswerSql = Prisma.sql`(
  JSON_TYPE(sa.value) IN ('INTEGER', 'DOUBLE')
  OR (
    JSON_TYPE(sa.value) = 'STRING'
    AND JSON_UNQUOTE(sa.value) REGEXP '^-?[0-9]+(\\.[0-9]+)?$'
  )
)`;

const groupBySql = (groupBy: DashboardGroupBy) => {
  if (groupBy === DashboardGroupBy.COMPANY) {
    return {
      key: Prisma.sql`c.slug`,
      label: Prisma.sql`c.name`
    };
  }

  if (groupBy === DashboardGroupBy.GERENCIA) {
    return {
      key: Prisma.sql`COALESCE(NULLIF(r.gerencia, ''), 'SIN_GERENCIA')`,
      label: Prisma.sql`COALESCE(NULLIF(r.gerencia, ''), 'Sin gerencia')`
    };
  }

  return {
    key: Prisma.sql`COALESCE(NULLIF(r.centro, ''), 'SIN_CENTRO')`,
    label: Prisma.sql`COALESCE(NULLIF(r.centro, ''), 'Sin centro')`
  };
};

const sectionSql = Prisma.sql`COALESCE(NULLIF(sa.sectionKey, ''), 'SIN_SECCION')`;

const ensureExportDir = () => {
  const absoluteDir = path.resolve(env.UPLOAD_DIR, 'dashboard-exports');
  fs.mkdirSync(absoluteDir, { recursive: true });
  return absoluteDir;
};

const safeErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message.slice(0, 600);
  }

  return 'Error no identificado';
};

export class DashboardService {
  private buildExportDownloadUrl(jobId: string): string {
    return `/api/dashboard/results/export/${jobId}/download`;
  }

  private assertCanReadReporting(principal: SessionPrincipal) {
    assertPrincipalRole(principal, rolePolicy.adminAndClientAdmin, {
      message: 'No tienes permisos para consultar reportes',
      code: 'DASHBOARD_READ_FORBIDDEN'
    });
  }

  private assertCanManageExports(principal: SessionPrincipal) {
    assertPrincipalRole(principal, rolePolicy.adminOnly, {
      message: 'Solo ADMIN puede gestionar exportaciones de reportes',
      code: 'DASHBOARD_EXPORT_ADMIN_REQUIRED'
    });
  }

  private assertCampaignEnabled(campaign: CampaignScope) {
    if (campaign.status === SurveyCampaignStatus.BORRADOR) {
      throw new AppError(
        'La encuesta aún no está disponible para dashboard',
        409,
        'SURVEY_CAMPAIGN_NOT_DASHBOARD_READY'
      );
    }
  }

  private async resolveCampaignBySurveySlug(
    surveySlugRaw: string,
    principal: SessionPrincipal
  ): Promise<CampaignScope> {
    const surveySlug = normalizeSlug(surveySlugRaw);

    if (!surveySlug) {
      throw new AppError('Slug de encuesta inválido', 400, 'INVALID_SURVEY_SLUG');
    }

    const campaign = await prisma.surveyCampaign.findUnique({
      where: {
        slug: surveySlug
      },
      select: {
        id: true,
        slug: true,
        name: true,
        status: true,
        startDate: true,
        endDate: true,
        company: {
          select: {
            id: true,
            slug: true,
            name: true
          }
        }
      }
    });

    if (!campaign) {
      throw new AppError('Encuesta no encontrada', 404, 'SURVEY_CAMPAIGN_NOT_FOUND');
    }

    if (principal.role !== Role.ADMIN && principal.companyId !== campaign.company.id) {
      throw new AppError('Acceso denegado', 403, 'COMPANY_SCOPE_FORBIDDEN');
    }

    return campaign;
  }

  private async fetchProgressRows(
    surveyCampaignId: string,
    groupBy: DashboardGroupBy
  ): Promise<DashboardProgressFetchResult> {
    const groupExpr = groupBySql(groupBy);
    const rows = await prisma.$queryRaw<ProgressRawRow[]>(Prisma.sql`
      SELECT
        ${groupExpr.key} AS groupKey,
        ${groupExpr.label} AS groupLabel,
        COUNT(r.id) AS totalRespondents,
        SUM(CASE WHEN sr.startedAt IS NOT NULL THEN 1 ELSE 0 END) AS startedRespondents,
        SUM(CASE WHEN sr.submittedAt IS NOT NULL THEN 1 ELSE 0 END) AS submittedRespondents
      FROM \`Respondent\` r
      INNER JOIN \`SurveyCampaign\` sc ON sc.id = r.surveyCampaignId
      INNER JOIN \`Company\` c ON c.id = sc.companyId
      LEFT JOIN \`SurveyResponse\` sr ON sr.respondentId = r.id
      WHERE r.surveyCampaignId = ${surveyCampaignId}
        AND r.isActive = true
      GROUP BY ${groupExpr.key}, ${groupExpr.label}
      ORDER BY ${groupExpr.label} ASC
    `);

    const normalized = rows.map((row) => ({
      groupKey: toNullableString(row.groupKey) ?? 'SIN_GRUPO',
      groupLabel: toNullableString(row.groupLabel) ?? 'Sin grupo',
      totalRespondents: toNumber(row.totalRespondents),
      startedRespondents: toNumber(row.startedRespondents),
      submittedRespondents: toNumber(row.submittedRespondents)
    }));

    const eligibleRows = normalized.filter(
      (row) => row.submittedRespondents >= DASHBOARD_ANONYMITY_MIN_COUNT
    );

    const aggregateTotals = normalized.reduce(
      (acc, row) => {
        acc.totalRespondents += row.totalRespondents;
        acc.startedRespondents += row.startedRespondents;
        acc.submittedRespondents += row.submittedRespondents;
        return acc;
      },
      {
        totalRespondents: 0,
        startedRespondents: 0,
        submittedRespondents: 0
      }
    );

    const aggregateVisible =
      aggregateTotals.submittedRespondents >= DASHBOARD_ANONYMITY_MIN_COUNT;

    return {
      rows: eligibleRows.map((row) => ({
        ...row,
        completionRate:
          row.totalRespondents > 0
            ? Number((row.submittedRespondents / row.totalRespondents).toFixed(4))
            : 0
      })),
      eligibleGroupKeys: new Set(eligibleRows.map((row) => row.groupKey)),
      suppressedGroups: normalized.length - eligibleRows.length,
      aggregateVisible,
      aggregateTotals: {
        ...aggregateTotals,
        completionRate:
          aggregateTotals.totalRespondents > 0
            ? Number(
                (
                  aggregateTotals.submittedRespondents /
                  aggregateTotals.totalRespondents
                ).toFixed(4)
              )
            : 0
      }
    };
  }

  private async fetchResultsRows(
    surveyCampaignId: string,
    groupBy: DashboardGroupBy,
    eligibleGroupKeys: Set<string>,
    aggregateFallbackLabel: string | null
  ): Promise<DashboardResultsFetchResult> {
    if (eligibleGroupKeys.size === 0 && !aggregateFallbackLabel) {
      return {
        overall: [],
        sections: [],
        questions: []
      };
    }

    const useAggregateFallback = eligibleGroupKeys.size === 0 && Boolean(aggregateFallbackLabel);
    const groupExpr = useAggregateFallback
      ? {
          key: Prisma.sql`${aggregateFallbackLabel}`,
          label: Prisma.sql`${aggregateFallbackLabel}`
        }
      : groupBySql(groupBy);
    const eligibleGroupList = Array.from(eligibleGroupKeys);
    const groupFilterSql = useAggregateFallback
      ? Prisma.empty
      : Prisma.sql`AND (${groupExpr.key}) IN (${Prisma.join(eligibleGroupList)})`;
    const overallGroupBySql = useAggregateFallback
      ? Prisma.empty
      : Prisma.sql`GROUP BY ${groupExpr.key}, ${groupExpr.label}
      ORDER BY ${groupExpr.label} ASC`;
    const sectionGroupBySql = useAggregateFallback
      ? Prisma.sql`GROUP BY ${sectionSql}
      ORDER BY ${sectionSql} ASC`
      : Prisma.sql`GROUP BY ${groupExpr.key}, ${sectionSql}
      ORDER BY ${groupExpr.key} ASC, ${sectionSql} ASC`;
    const questionGroupBySql = useAggregateFallback
      ? Prisma.sql`GROUP BY ${sectionSql}, sa.questionKey
      ORDER BY ${sectionSql} ASC, sa.questionKey ASC`
      : Prisma.sql`GROUP BY ${groupExpr.key}, ${sectionSql}, sa.questionKey
      ORDER BY ${groupExpr.key} ASC, ${sectionSql} ASC, sa.questionKey ASC`;

    const overallRows = await prisma.$queryRaw<ResultOverallRawRow[]>(Prisma.sql`
      SELECT
        ${groupExpr.key} AS groupKey,
        ${groupExpr.label} AS groupLabel,
        COUNT(DISTINCT sr.id) AS submittedRespondents,
        COUNT(sa.id) AS answerCount,
        AVG(CAST(JSON_UNQUOTE(sa.value) AS DECIMAL(10,4))) AS averageScore
      FROM \`SurveyAnswer\` sa
      INNER JOIN \`SurveyResponse\` sr ON sr.id = sa.surveyResponseId
      INNER JOIN \`Respondent\` r ON r.id = sr.respondentId
      INNER JOIN \`SurveyCampaign\` sc ON sc.id = r.surveyCampaignId
      INNER JOIN \`Company\` c ON c.id = sc.companyId
      WHERE sa.surveyCampaignId = ${surveyCampaignId}
        AND sr.submittedAt IS NOT NULL
        AND r.isActive = true
        AND ${numericAnswerSql}
        ${groupFilterSql}
      ${overallGroupBySql}
    `);

    const sectionRows = await prisma.$queryRaw<ResultSectionRawRow[]>(Prisma.sql`
      SELECT
        ${groupExpr.key} AS groupKey,
        ${sectionSql} AS sectionKey,
        COUNT(sa.id) AS answerCount,
        AVG(CAST(JSON_UNQUOTE(sa.value) AS DECIMAL(10,4))) AS averageScore
      FROM \`SurveyAnswer\` sa
      INNER JOIN \`SurveyResponse\` sr ON sr.id = sa.surveyResponseId
      INNER JOIN \`Respondent\` r ON r.id = sr.respondentId
      INNER JOIN \`SurveyCampaign\` sc ON sc.id = r.surveyCampaignId
      INNER JOIN \`Company\` c ON c.id = sc.companyId
      WHERE sa.surveyCampaignId = ${surveyCampaignId}
        AND sr.submittedAt IS NOT NULL
        AND r.isActive = true
        AND ${numericAnswerSql}
        ${groupFilterSql}
      ${sectionGroupBySql}
    `);

    const questionRows = await prisma.$queryRaw<ResultQuestionRawRow[]>(Prisma.sql`
      SELECT
        ${groupExpr.key} AS groupKey,
        ${sectionSql} AS sectionKey,
        sa.questionKey AS questionKey,
        COUNT(sa.id) AS answerCount,
        AVG(CAST(JSON_UNQUOTE(sa.value) AS DECIMAL(10,4))) AS averageScore
      FROM \`SurveyAnswer\` sa
      INNER JOIN \`SurveyResponse\` sr ON sr.id = sa.surveyResponseId
      INNER JOIN \`Respondent\` r ON r.id = sr.respondentId
      INNER JOIN \`SurveyCampaign\` sc ON sc.id = r.surveyCampaignId
      INNER JOIN \`Company\` c ON c.id = sc.companyId
      WHERE sa.surveyCampaignId = ${surveyCampaignId}
        AND sr.submittedAt IS NOT NULL
        AND r.isActive = true
        AND ${numericAnswerSql}
        ${groupFilterSql}
      ${questionGroupBySql}
    `);

    return {
      overall: overallRows.map((row) => ({
        groupKey: toNullableString(row.groupKey) ?? 'SIN_GRUPO',
        groupLabel: toNullableString(row.groupLabel) ?? 'Sin grupo',
        submittedRespondents: toNumber(row.submittedRespondents),
        answerCount: toNumber(row.answerCount),
        averageScore: Number(toNumber(row.averageScore).toFixed(4))
      })),
      sections: sectionRows.map((row) => ({
        groupKey: toNullableString(row.groupKey) ?? 'SIN_GRUPO',
        sectionKey: toNullableString(row.sectionKey) ?? 'SIN_SECCION',
        answerCount: toNumber(row.answerCount),
        averageScore: Number(toNumber(row.averageScore).toFixed(4))
      })),
      questions: questionRows.map((row) => ({
        groupKey: toNullableString(row.groupKey) ?? 'SIN_GRUPO',
        sectionKey: toNullableString(row.sectionKey) ?? 'SIN_SECCION',
        questionKey: toNullableString(row.questionKey) ?? 'SIN_PREGUNTA',
        answerCount: toNumber(row.answerCount),
        averageScore: Number(toNumber(row.averageScore).toFixed(4))
      }))
    };
  }

  async getDashboardProgress(query: DashboardProgressQueryDto, principal: SessionPrincipal) {
    this.assertCanReadReporting(principal);
    const campaign = await this.resolveCampaignBySurveySlug(query.surveySlug, principal);
    this.assertCampaignEnabled(campaign);

    const progress = await this.fetchProgressRows(campaign.id, query.groupBy);

    const reducedVisibleTotals =
      progress.rows.reduce(
        (acc, row) => {
          acc.totalRespondents += row.totalRespondents;
          acc.startedRespondents += row.startedRespondents;
          acc.submittedRespondents += row.submittedRespondents;
          return acc;
        },
        {
          totalRespondents: 0,
          startedRespondents: 0,
          submittedRespondents: 0
        }
      );

    const totals =
      progress.rows.length > 0 || !progress.aggregateVisible
        ? reducedVisibleTotals
        : progress.aggregateTotals;

    return {
      survey: {
        id: campaign.id,
        slug: campaign.slug,
        name: campaign.name,
        company: campaign.company
      },
      groupBy: query.groupBy,
      anonymityMinCount: DASHBOARD_ANONYMITY_MIN_COUNT,
      suppressedGroups: progress.suppressedGroups,
      aggregateVisible: progress.aggregateVisible,
      totals: {
        totalRespondents: totals.totalRespondents,
        startedRespondents: totals.startedRespondents,
        submittedRespondents: totals.submittedRespondents,
        completionRate:
          progress.rows.length > 0 || !progress.aggregateVisible
            ? totals.totalRespondents > 0
              ? Number((totals.submittedRespondents / totals.totalRespondents).toFixed(4))
              : 0
            : progress.aggregateTotals.completionRate
      },
      groups: progress.rows
    };
  }

  async getDashboardResults(query: DashboardResultsQueryDto, principal: SessionPrincipal) {
    this.assertCanReadReporting(principal);
    const campaign = await this.resolveCampaignBySurveySlug(query.surveySlug, principal);
    this.assertCampaignEnabled(campaign);

    const progress = await this.fetchProgressRows(campaign.id, query.groupBy);
    const results = await this.fetchResultsRows(
      campaign.id,
      query.groupBy,
      progress.eligibleGroupKeys,
      progress.rows.length === 0 && progress.aggregateVisible ? 'Total campaña' : null
    );

    return {
      survey: {
        id: campaign.id,
        slug: campaign.slug,
        name: campaign.name,
        company: campaign.company
      },
      groupBy: query.groupBy,
      anonymityMinCount: DASHBOARD_ANONYMITY_MIN_COUNT,
      suppressedGroups: progress.suppressedGroups,
      aggregateVisible: progress.aggregateVisible,
      overall: results.overall,
      sections: results.sections,
      questions: results.questions
    };
  }

  async createDashboardExportJob(
    input: CreateDashboardExportJobDto,
    principal: SessionPrincipal
  ) {
    this.assertCanManageExports(principal);
    const campaign = await this.resolveCampaignBySurveySlug(input.surveySlug, principal);
    this.assertCampaignEnabled(campaign);

    const job = await prisma.dashboardExportJob.create({
      data: {
        surveyCampaignId: campaign.id,
        requestedByUserId: principal.id,
        groupBy: input.groupBy,
        status: DashboardExportJobStatus.PENDING,
        maxAttempts: env.DASHBOARD_EXPORT_MAX_RETRIES
      },
      select: {
        id: true,
        status: true,
        groupBy: true,
        attemptCount: true,
        maxAttempts: true,
        nextRetryAt: true,
        createdAt: true
      }
    });

    return {
      ...job,
      format: DASHBOARD_EXPORT_FORMAT,
      canDownload: false,
      survey: {
        id: campaign.id,
        slug: campaign.slug,
        name: campaign.name
      }
    };
  }

  async listDashboardExportJobs(
    query: ListDashboardExportJobsQueryDto,
    principal: SessionPrincipal
  ) {
    this.assertCanReadReporting(principal);
    const campaign = await this.resolveCampaignBySurveySlug(query.surveySlug, principal);
    this.assertCampaignEnabled(campaign);

    const jobs = await prisma.dashboardExportJob.findMany({
      where: {
        surveyCampaignId: campaign.id,
        groupBy: query.groupBy
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: query.limit,
      select: {
        id: true,
        status: true,
        groupBy: true,
        attemptCount: true,
        maxAttempts: true,
        nextRetryAt: true,
        createdAt: true,
        updatedAt: true,
        startedAt: true,
        completedAt: true,
        filePath: true,
        errorMessage: true
      }
    });

    return {
      survey: {
        id: campaign.id,
        slug: campaign.slug,
        name: campaign.name
      },
      groupBy: query.groupBy,
      supportedFormats: DASHBOARD_EXPORT_SUPPORTED_FORMATS,
      jobs: jobs.map((job) => {
        const canDownload =
          principal.role === Role.ADMIN &&
          job.status === DashboardExportJobStatus.COMPLETED &&
          Boolean(job.filePath);

        return {
          id: job.id,
          status: job.status,
          groupBy: job.groupBy,
          format: DASHBOARD_EXPORT_FORMAT,
          canDownload,
          attemptCount: job.attemptCount,
          maxAttempts: job.maxAttempts,
          nextRetryAt: job.nextRetryAt,
          createdAt: job.createdAt,
          updatedAt: job.updatedAt,
          startedAt: job.startedAt,
          completedAt: job.completedAt,
          downloadUrl: canDownload ? this.buildExportDownloadUrl(job.id) : null,
          errorMessage: job.status === DashboardExportJobStatus.FAILED ? job.errorMessage : null,
          survey: {
            id: campaign.id,
            slug: campaign.slug,
            name: campaign.name,
            company: campaign.company
          }
        };
      })
    };
  }

  async getDashboardExportJob(jobIdRaw: string, principal: SessionPrincipal) {
    this.assertCanReadReporting(principal);
    const jobId = jobIdRaw.trim();
    if (!jobId) {
      throw new AppError('ID de job inválido', 400, 'INVALID_EXPORT_JOB_ID');
    }

    const job = await prisma.dashboardExportJob.findUnique({
      where: {
        id: jobId
      },
      select: {
        id: true,
        status: true,
        groupBy: true,
        attemptCount: true,
        maxAttempts: true,
        nextRetryAt: true,
        createdAt: true,
        updatedAt: true,
        startedAt: true,
        completedAt: true,
        filePath: true,
        fileUrl: true,
        errorMessage: true,
        surveyCampaign: {
          select: {
            id: true,
            slug: true,
            name: true,
            company: {
              select: {
                id: true,
                slug: true,
                name: true
              }
            }
          }
        }
      }
    });

    if (!job) {
      throw new AppError('Job no encontrado', 404, 'DASHBOARD_EXPORT_JOB_NOT_FOUND');
    }

    if (principal.role !== Role.ADMIN && principal.companyId !== job.surveyCampaign.company.id) {
      throw new AppError('Acceso denegado', 403, 'COMPANY_SCOPE_FORBIDDEN');
    }

    const canDownload =
      principal.role === Role.ADMIN &&
      job.status === DashboardExportJobStatus.COMPLETED &&
      Boolean(job.filePath);

    return {
      id: job.id,
      status: job.status,
      groupBy: job.groupBy,
      format: DASHBOARD_EXPORT_FORMAT,
      canDownload,
      attemptCount: job.attemptCount,
      maxAttempts: job.maxAttempts,
      nextRetryAt: job.nextRetryAt,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      downloadUrl: canDownload ? this.buildExportDownloadUrl(job.id) : null,
      errorMessage: job.status === DashboardExportJobStatus.FAILED ? job.errorMessage : null,
      survey: {
        id: job.surveyCampaign.id,
        slug: job.surveyCampaign.slug,
        name: job.surveyCampaign.name,
        company: job.surveyCampaign.company
      }
    };
  }

  async getDashboardExportDownload(jobIdRaw: string, principal: SessionPrincipal) {
    this.assertCanManageExports(principal);
    const jobId = jobIdRaw.trim();
    if (!jobId) {
      throw new AppError('ID de job inválido', 400, 'INVALID_EXPORT_JOB_ID');
    }

    const job = await prisma.dashboardExportJob.findUnique({
      where: {
        id: jobId
      },
      select: {
        id: true,
        status: true,
        groupBy: true,
        filePath: true,
        surveyCampaign: {
          select: {
            slug: true,
            company: {
              select: {
                id: true
              }
            }
          }
        }
      }
    });

    if (!job) {
      throw new AppError('Job no encontrado', 404, 'DASHBOARD_EXPORT_JOB_NOT_FOUND');
    }

    if (principal.role !== Role.ADMIN && principal.companyId !== job.surveyCampaign.company.id) {
      throw new AppError('Acceso denegado', 403, 'COMPANY_SCOPE_FORBIDDEN');
    }

    if (job.status !== DashboardExportJobStatus.COMPLETED || !job.filePath) {
      throw new AppError(
        'La exportación aún no está lista para descargar',
        409,
        'DASHBOARD_EXPORT_NOT_READY'
      );
    }

    const exportDir = ensureExportDir();
    const resolvedExportDir = path.resolve(exportDir);
    const filePath = path.resolve(job.filePath);
    const safePrefix = `${resolvedExportDir}${path.sep}`;

    if (!filePath.startsWith(safePrefix)) {
      throw new AppError(
        'Ruta de archivo de exportación inválida',
        500,
        'DASHBOARD_EXPORT_PATH_INVALID'
      );
    }

    if (!fs.existsSync(filePath)) {
      throw new AppError(
        'El archivo de exportación no está disponible',
        410,
        'DASHBOARD_EXPORT_FILE_MISSING'
      );
    }

    const safeSlug = normalizeSlug(job.surveyCampaign.slug) || 'encuesta';
    const fileName = `resultados-${safeSlug}-${job.groupBy.toLowerCase()}.xlsx`;

    return {
      filePath,
      fileName,
      mimeType: DASHBOARD_EXPORT_MIME_TYPE
    };
  }

  private async generateAnonymizedExcelForJob(jobId: string) {
    const job = await prisma.dashboardExportJob.findUnique({
      where: {
        id: jobId
      },
      select: {
        id: true,
        groupBy: true,
        surveyCampaign: {
          select: {
            id: true,
            slug: true,
            name: true,
            status: true,
            startDate: true,
            endDate: true,
            company: {
              select: {
                id: true,
                slug: true,
                name: true
              }
            }
          }
        }
      }
    });

    if (!job) {
      throw new AppError('Job no encontrado', 404, 'DASHBOARD_EXPORT_JOB_NOT_FOUND');
    }

    const progress = await this.fetchProgressRows(job.surveyCampaign.id, job.groupBy);
    const results = await this.fetchResultsRows(
      job.surveyCampaign.id,
      job.groupBy,
      progress.eligibleGroupKeys,
      progress.rows.length === 0 && progress.aggregateVisible ? 'Total campaña' : null
    );

    const workbook = XLSX.utils.book_new();

    const summaryRows = results.overall.map((row) => ({
      Grupo: row.groupLabel,
      ClaveGrupo: row.groupKey,
      Respondentes: row.submittedRespondents,
      RespuestasNumericas: row.answerCount,
      Promedio: row.averageScore
    }));

    const sectionRows = results.sections.map((row) => ({
      Grupo: row.groupKey,
      Seccion: row.sectionKey,
      RespuestasNumericas: row.answerCount,
      Promedio: row.averageScore
    }));

    const questionRows = results.questions.map((row) => ({
      Grupo: row.groupKey,
      Seccion: row.sectionKey,
      Pregunta: row.questionKey,
      RespuestasNumericas: row.answerCount,
      Promedio: row.averageScore
    }));

    const metaRows = [
      {
        Clave: 'survey_slug',
        Valor: job.surveyCampaign.slug
      },
      {
        Clave: 'survey_name',
        Valor: job.surveyCampaign.name
      },
      {
        Clave: 'company_slug',
        Valor: job.surveyCampaign.company.slug
      },
      {
        Clave: 'company_name',
        Valor: job.surveyCampaign.company.name
      },
      {
        Clave: 'group_by',
        Valor: job.groupBy
      },
      {
        Clave: 'anonymity_min_count',
        Valor: String(DASHBOARD_ANONYMITY_MIN_COUNT)
      },
      {
        Clave: 'suppressed_groups',
        Valor: String(progress.suppressedGroups)
      }
    ];

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(metaRows),
      'Meta'
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(summaryRows),
      'Resumen'
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(sectionRows),
      'PromediosSeccion'
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(questionRows),
      'PromediosPregunta'
    );

    const exportDir = ensureExportDir();
    const safeSlug = normalizeSlug(job.surveyCampaign.slug) || 'survey';
    const fileName = `dashboard-export-${safeSlug}-${Date.now()}-${randomUUID().slice(0, 8)}.xlsx`;
    const filePath = path.resolve(exportDir, fileName);

    XLSX.writeFile(workbook, filePath, { compression: true });

    return {
      filePath,
      fileUrl: `/uploads/dashboard-exports/${fileName}`
    };
  }

  private async processExportJob(jobId: string) {
    const now = new Date();

    const claimed = await prisma.dashboardExportJob.updateMany({
      where: {
        id: jobId,
        OR: [
          { status: DashboardExportJobStatus.PENDING },
          {
            status: DashboardExportJobStatus.FAILED,
            nextRetryAt: {
              lte: now
            }
          }
        ]
      },
      data: {
        status: DashboardExportJobStatus.PROCESSING,
        startedAt: now,
        attemptCount: {
          increment: 1
        },
        errorMessage: null
      }
    });

    if (claimed.count === 0) {
      return { processed: false };
    }

    const currentJob = await prisma.dashboardExportJob.findUnique({
      where: { id: jobId },
      select: { id: true, attemptCount: true, maxAttempts: true }
    });

    if (!currentJob) {
      return { processed: false };
    }

    try {
      const file = await this.generateAnonymizedExcelForJob(jobId);

      await prisma.dashboardExportJob.update({
        where: {
          id: jobId
        },
        data: {
          status: DashboardExportJobStatus.COMPLETED,
          completedAt: new Date(),
          nextRetryAt: null,
          filePath: file.filePath,
          fileUrl: file.fileUrl,
          errorMessage: null
        }
      });

      return { processed: true, status: DashboardExportJobStatus.COMPLETED };
    } catch (error) {
      const shouldRetry = currentJob.attemptCount < currentJob.maxAttempts;
      const nextRetryAt = shouldRetry
        ? new Date(Date.now() + env.DASHBOARD_EXPORT_RETRY_DELAY_SECONDS * 1000)
        : null;

      await prisma.dashboardExportJob.update({
        where: {
          id: jobId
        },
        data: {
          status: DashboardExportJobStatus.FAILED,
          completedAt: shouldRetry ? null : new Date(),
          nextRetryAt,
          errorMessage: safeErrorMessage(error)
        }
      });

      return { processed: true, status: DashboardExportJobStatus.FAILED };
    }
  }

  async processDueExportJobs(input: { limit: number }) {
    const now = new Date();
    const jobs = await prisma.dashboardExportJob.findMany({
      where: {
        OR: [
          {
            status: DashboardExportJobStatus.PENDING
          },
          {
            status: DashboardExportJobStatus.FAILED,
            nextRetryAt: {
              lte: now
            }
          }
        ]
      },
      orderBy: {
        createdAt: 'asc'
      },
      take: input.limit
    });

    const processed: Array<{ id: string; status: DashboardExportJobStatus | 'SKIPPED' }> =
      [];
    for (const job of jobs) {
      const result = await this.processExportJob(job.id);
      processed.push({
        id: job.id,
        status: result.processed ? (result.status ?? 'SKIPPED') : 'SKIPPED'
      });
    }

    return {
      totalQueued: jobs.length,
      processed: processed.filter((item) => item.status !== 'SKIPPED').length,
      jobs: processed
    };
  }
}
