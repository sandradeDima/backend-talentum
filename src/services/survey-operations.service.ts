import {
  Prisma,
  ReminderDispatchStatus,
  ReminderScheduleStatus,
  Role,
  RespondentCredentialType,
  SurveyResponseStatus,
  SurveyCampaignStatus
} from '@prisma/client';
import * as XLSX from 'xlsx';
import { env } from '../config/env';
import type {
  CreateReminderSchedulesDto,
  GenerateRespondentCredentialsDto,
  ImportSurveyRespondentsDto
} from '../dto/survey-operations.dto';
import { AppError } from '../errors/appError';
import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';
import { assertPrincipalRole, rolePolicy } from '../lib/role-policy';
import type { SessionPrincipal } from '../types/auth';
import { randomToken, sha256 } from '../utils/hash';
import { normalizeSlug } from '../utils/slug';
import { MailService } from './mail.service';
import { retryQueueService } from './retry-queue.service';

const DEFAULT_CSV_DELIMITER = ',';
const REMINDER_MAX_RETRIES = env.REMINDER_MAX_RETRIES;
const REMINDER_DISPATCH_MAX_RETRIES = env.REMINDER_DISPATCH_MAX_RETRIES;
const REMINDER_RETRY_DELAY_SECONDS = env.REMINDER_RETRY_DELAY_SECONDS;
const ACCESS_CODE_SUFFIX_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const ACCESS_CODE_SUFFIX_LENGTH = 2;
const MAX_RESPONDENT_IDENTIFIER_LENGTH = 160;

const headerAliases = {
  identifier: [
    'documento',
    'nrodocumento',
    'numerodedocumento',
    'documentoidentidad',
    'cedula',
    'ci',
    'dni',
    'pasaporte',
    'identifier',
    'identificador',
    'codigo',
    'code',
    'employeeid',
    'userid',
    'id'
  ],
  fullName: [
    'nombrecompleto',
    'nombreyapellido',
    'nombresyapellidos',
    'fullname',
    'nombre',
    'name',
    'colaborador',
    'empleado'
  ],
  email: ['email', 'correo', 'correoelectronico', 'mail'],
  gerencia: ['gerencia', 'management', 'managementunit', 'direction'],
  centro: ['centro', 'centrodecosto', 'centrocosto', 'costcenter', 'center']
};

type ImportRowError = {
  rowNumber: number;
  identifier: string | null;
  errors: string[];
};

type ValidImportRow = {
  rowNumber: number;
  identifier: string;
  identifierKey: string;
  fullName: string | null;
  email: string | null;
  gerencia: string | null;
  centro: string | null;
  metadata: Prisma.InputJsonValue | null;
};

type CampaignScope = {
  company: {
    id: string;
    name: string;
    slug: string;
  };
  campaign: {
    id: string;
    slug: string;
    name: string;
    status: SurveyCampaignStatus;
    startDate: Date;
    endDate: Date;
  };
};

type CredentialIssueResult = {
  credentialId: string;
  rawCredential: string | null;
  credentialType: RespondentCredentialType;
  expiresAt: Date;
  reused: boolean;
};

type SurveyOperationsSummaryResponse = {
  survey: {
    id: string;
    slug: string;
    name: string;
    status: SurveyCampaignStatus;
    startDate: Date;
    endDate: Date;
  };
  participants: {
    total: number;
    active: number;
    inactive: number;
    withEmail: number;
    withoutEmail: number;
    lastImportedAt: Date | null;
  };
  responses: {
    notStarted: number;
    inProgress: number;
    submitted: number;
    completionRate: number;
  };
  credentials: {
    totalIssued: number;
    active: number;
    expired: number;
    consumed: number;
    revoked: number;
    byType: {
      TOKEN: number;
      PIN: number;
    };
    latestIssuedAt: Date | null;
  };
  reminders: {
    totalSchedules: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    nextScheduledAt: Date | null;
    lastProcessedAt: Date | null;
  };
};

const normalizeHeader = (value: string): string => {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
};

const normalizeOptionalText = (value: unknown): string | null => {
  if (value === null || typeof value === 'undefined') {
    return null;
  }

  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
};

const isValidEmail = (value: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
};

const parseDateTimeInput = (input: string): Date => {
  const localDateTimePattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
  const localMatch = input.match(localDateTimePattern);

  if (localMatch) {
    const [, year, month, day, hour, minute] = localMatch;
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      0,
      0
    );
  }

  return new Date(input);
};

const sanitizeErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message.slice(0, 500);
  }

  return 'Error desconocido al enviar correo';
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const createAccessCodeSuffix = () => {
  let suffix = '';

  for (let index = 0; index < ACCESS_CODE_SUFFIX_LENGTH; index += 1) {
    const characterIndex = Math.floor(
      Math.random() * ACCESS_CODE_SUFFIX_ALPHABET.length
    );
    suffix += ACCESS_CODE_SUFFIX_ALPHABET[characterIndex];
  }

  return suffix;
};

const appendAccessCodeSuffix = (value: string) => {
  const suffix = `-${createAccessCodeSuffix()}`;
  const maxBaseLength = Math.max(
    1,
    MAX_RESPONDENT_IDENTIFIER_LENGTH - suffix.length
  );

  return `${value.slice(0, maxBaseLength)}${suffix}`;
};

export class SurveyOperationsService {
  constructor(private readonly mailService: MailService) {}

  private assertCanReadOperations(principal: SessionPrincipal) {
    assertPrincipalRole(principal, rolePolicy.adminAndClientAdmin, {
      message: 'No tienes permisos para consultar operaciones de campaña',
      code: 'SURVEY_OPERATIONS_READ_FORBIDDEN'
    });
  }

  private assertCanManageSensitiveOperations(principal: SessionPrincipal) {
    assertPrincipalRole(principal, rolePolicy.adminOnly, {
      message: 'Solo ADMIN puede ejecutar operaciones sensibles de campaña',
      code: 'SURVEY_OPERATIONS_ADMIN_REQUIRED'
    });
  }

  private async sendInvitationWithRetry(input: {
    respondentId: string;
    to: string;
    companyName: string;
    campaignName: string;
    campaignSlug: string;
    magicLinkToken: string;
    accessCode?: string;
    expiresAt: Date;
  }) {
    await retryQueueService.execute({
      key: `mail:invitation:${input.respondentId}:${input.expiresAt.getTime()}`,
      maxAttempts: REMINDER_DISPATCH_MAX_RETRIES,
      initialDelayMs: env.WORKER_TICK_RETRY_DELAY_MS,
      run: () =>
        this.mailService.sendSurveyInvitationEmail({
          to: input.to,
          companyName: input.companyName,
          campaignName: input.campaignName,
          campaignSlug: input.campaignSlug,
          magicLinkToken: input.magicLinkToken,
          ...(input.accessCode ? { accessCode: input.accessCode } : {}),
          expiresAt: input.expiresAt
        })
    });
  }

  private async sendReminderWithRetry(input: {
    respondentId: string;
    scheduleId: string;
    to: string;
    companyName: string;
    campaignName: string;
    campaignSlug: string;
    magicLinkToken: string;
    accessCode: string;
    expiresAt: Date;
  }) {
    await retryQueueService.execute({
      key: `mail:reminder:${input.scheduleId}:${input.respondentId}:${input.expiresAt.getTime()}`,
      maxAttempts: REMINDER_DISPATCH_MAX_RETRIES,
      initialDelayMs: env.WORKER_TICK_RETRY_DELAY_MS,
      run: () =>
        this.mailService.sendSurveyReminderEmail({
          to: input.to,
          companyName: input.companyName,
          campaignName: input.campaignName,
          campaignSlug: input.campaignSlug,
          magicLinkToken: input.magicLinkToken,
          accessCode: input.accessCode,
          expiresAt: input.expiresAt
        })
    });
  }

  private assertCampaignIsOpen(campaign: CampaignScope['campaign']) {
    if (campaign.status === SurveyCampaignStatus.BORRADOR) {
      throw new AppError(
        'La encuesta no está habilitada para operaciones de colaboradores',
        409,
        'SURVEY_CAMPAIGN_NOT_READY'
      );
    }

    if (campaign.endDate.getTime() < Date.now()) {
      throw new AppError('La encuesta ya finalizó', 409, 'SURVEY_CAMPAIGN_FINISHED');
    }
  }

  private resolveColumn(headers: string[], aliases: string[]) {
    const aliasSet = new Set(aliases.map((alias) => normalizeHeader(alias)));
    return headers.find((header) => aliasSet.has(normalizeHeader(header))) ?? null;
  }

  private detectCsvDelimiter(headerLine: string) {
    const semicolons = (headerLine.match(/;/g) ?? []).length;
    const commas = (headerLine.match(/,/g) ?? []).length;
    return semicolons > commas ? ';' : DEFAULT_CSV_DELIMITER;
  }

  private parseCsv(content: string) {
    const rows: string[][] = [];
    let currentField = '';
    let currentRow: string[] = [];
    let inQuotes = false;
    const headerLine = content.split(/\r?\n/, 1)[0] ?? '';
    const delimiter = this.detectCsvDelimiter(headerLine);

    for (let index = 0; index < content.length; index += 1) {
      const char = content[index];
      const next = content[index + 1];

      if (char === '"') {
        if (inQuotes && next === '"') {
          currentField += '"';
          index += 1;
          continue;
        }

        inQuotes = !inQuotes;
        continue;
      }

      if (!inQuotes && char === delimiter) {
        currentRow.push(currentField);
        currentField = '';
        continue;
      }

      if (!inQuotes && (char === '\n' || char === '\r')) {
        if (char === '\r' && next === '\n') {
          index += 1;
        }

        currentRow.push(currentField);
        rows.push(currentRow);
        currentField = '';
        currentRow = [];
        continue;
      }

      currentField += char;
    }

    if (currentField.length > 0 || currentRow.length > 0) {
      currentRow.push(currentField);
      rows.push(currentRow);
    }

    if (rows.length === 0) {
      throw new AppError('Archivo CSV vacío', 400, 'EMPTY_RESPONDENT_IMPORT_FILE');
    }

    const rawHeaders = rows[0] ?? [];
    const headers = rawHeaders.map((header) =>
      header.replace(/^\uFEFF/, '').trim()
    );
    const dataRows = rows
      .slice(1)
      .map((row) => row.map((cell) => cell.trim()))
      .filter((row) => row.some((cell) => cell.length > 0));

    return {
      headers,
      rows: dataRows.map((row) => {
        const mapped: Record<string, string> = {};
        headers.forEach((header, index) => {
          mapped[header] = row[index] ?? '';
        });
        return mapped;
      })
    };
  }

  private parseXlsx(buffer: Buffer) {
    const workbook = XLSX.read(buffer, {
      type: 'buffer',
      raw: false,
      cellDates: false
    });

    if (workbook.SheetNames.length === 0) {
      throw new AppError('Archivo XLSX sin hojas', 400, 'INVALID_RESPONDENT_IMPORT_FILE');
    }

    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new AppError('Archivo XLSX sin hojas', 400, 'INVALID_RESPONDENT_IMPORT_FILE');
    }

    const sheet = workbook.Sheets[firstSheetName];
    if (!sheet) {
      throw new AppError('No se pudo leer la hoja del archivo XLSX', 400, 'INVALID_XLSX_SHEET');
    }
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: false,
      defval: ''
    });

    if (matrix.length === 0) {
      throw new AppError('Archivo XLSX vacío', 400, 'EMPTY_RESPONDENT_IMPORT_FILE');
    }

    const headers = (matrix[0] ?? [])
      .map((value) => String(value ?? '').trim())
      .map((value) => value.replace(/^\uFEFF/, ''));

    const rows = matrix
      .slice(1)
      .map((sourceRow) => sourceRow.map((value) => String(value ?? '').trim()))
      .filter((row) => row.some((cell) => cell.length > 0))
      .map((row) => {
        const mapped: Record<string, string> = {};
        headers.forEach((header, index) => {
          mapped[header] = row[index] ?? '';
        });
        return mapped;
      });

    return {
      headers,
      rows
    };
  }

  private parseImportFile(input: ImportSurveyRespondentsDto) {
    let buffer: Buffer;
    try {
      buffer = Buffer.from(input.base64, 'base64');
    } catch {
      throw new AppError('Contenido base64 inválido', 400, 'INVALID_IMPORT_BASE64');
    }

    if (!buffer || buffer.length === 0) {
      throw new AppError('Archivo vacío', 400, 'EMPTY_RESPONDENT_IMPORT_FILE');
    }

    if (
      input.mimeType === 'text/csv' ||
      input.mimeType === 'application/csv'
    ) {
      return this.parseCsv(buffer.toString('utf8'));
    }

    return this.parseXlsx(buffer);
  }

  private resolveScope(
    companySlugRaw: string,
    surveySlugRaw: string,
    principal: SessionPrincipal
  ) {
    const companySlug = normalizeSlug(companySlugRaw);
    const surveySlug = normalizeSlug(surveySlugRaw);

    if (!companySlug) {
      throw new AppError('Slug de empresa inválido', 400, 'INVALID_COMPANY_SLUG');
    }

    if (!surveySlug) {
      throw new AppError('Slug de encuesta inválido', 400, 'INVALID_SURVEY_SLUG');
    }

    return prisma.$transaction(async (tx) => {
      const company = await tx.company.findUnique({
        where: {
          slug: companySlug
        },
        select: {
          id: true,
          name: true,
          slug: true
        }
      });

      if (!company) {
        throw new AppError('Empresa no encontrada', 404, 'COMPANY_NOT_FOUND');
      }

      if (principal.role !== Role.ADMIN && principal.companyId !== company.id) {
        throw new AppError('Acceso denegado', 403, 'COMPANY_SCOPE_FORBIDDEN');
      }

      const campaign = await tx.surveyCampaign.findFirst({
        where: {
          companyId: company.id,
          slug: surveySlug
        },
        select: {
          id: true,
          slug: true,
          name: true,
          status: true,
          startDate: true,
          endDate: true
        }
      });

      if (!campaign) {
        throw new AppError('Encuesta no encontrada', 404, 'SURVEY_CAMPAIGN_NOT_FOUND');
      }

      return {
        company,
        campaign
      };
    });
  }

  private getCredentialExpiry(
    campaign: CampaignScope['campaign'],
    overrideExpiration?: string
  ) {
    const now = Date.now();
    const defaultExpiry = Math.min(
      campaign.endDate.getTime(),
      now + env.SURVEY_ACCESS_CREDENTIAL_EXPIRES_HOURS * 60 * 60 * 1000
    );

    if (!overrideExpiration) {
      return new Date(defaultExpiry);
    }

    const parsed = parseDateTimeInput(overrideExpiration);
    if (Number.isNaN(parsed.getTime())) {
      throw new AppError(
        'Fecha de expiración de credencial inválida',
        400,
        'INVALID_CREDENTIAL_EXPIRATION'
      );
    }

    if (parsed.getTime() <= now) {
      throw new AppError(
        'La expiración de credencial debe ser futura',
        400,
        'CREDENTIAL_EXPIRATION_MUST_BE_FUTURE'
      );
    }

    return parsed.getTime() > campaign.endDate.getTime() ? campaign.endDate : parsed;
  }

  private createRawCredential(
    credentialType: RespondentCredentialType,
    accessCode?: string | null
  ) {
    if (credentialType === RespondentCredentialType.PIN) {
      if (!accessCode) {
        throw new AppError(
          'No se pudo generar el codigo de acceso del respondente',
          500,
          'RESPONDENT_ACCESS_CODE_REQUIRED'
        );
      }

      return accessCode;
    }

    return randomToken(24);
  }

  private async issueCredentialTx(
    tx: Prisma.TransactionClient,
    input: {
      respondentId: string;
      surveyCampaignId: string;
      credentialType: RespondentCredentialType;
      expiresAt: Date;
      regenerate: boolean;
      accessCode?: string | null;
    }
  ): Promise<CredentialIssueResult> {
    const now = new Date();

    if (!input.regenerate) {
      const activeCredential = await tx.respondentAccessCredential.findFirst({
        where: {
          respondentId: input.respondentId,
          surveyCampaignId: input.surveyCampaignId,
          credentialType: input.credentialType,
          consumedAt: null,
          revokedAt: null,
          expiresAt: {
            gt: now
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      if (activeCredential) {
        return {
          credentialId: activeCredential.id,
          rawCredential: null,
          credentialType: activeCredential.credentialType,
          expiresAt: activeCredential.expiresAt,
          reused: true
        };
      }
    }

    await tx.respondentAccessCredential.updateMany({
      where: {
        respondentId: input.respondentId,
        surveyCampaignId: input.surveyCampaignId,
        credentialType: input.credentialType,
        consumedAt: null,
        revokedAt: null
      },
      data: {
        revokedAt: now
      }
    });

    const rawCredential = this.createRawCredential(
      input.credentialType,
      input.accessCode
    );
    const credentialHash = sha256(rawCredential);

    const created = await tx.respondentAccessCredential.create({
      data: {
        respondentId: input.respondentId,
        surveyCampaignId: input.surveyCampaignId,
        credentialType: input.credentialType,
        tokenHash:
          input.credentialType === RespondentCredentialType.TOKEN ? credentialHash : null,
        pinHash:
          input.credentialType === RespondentCredentialType.PIN ? credentialHash : null,
        expiresAt: input.expiresAt
      }
    });

    return {
      credentialId: created.id,
      rawCredential,
      credentialType: created.credentialType,
      expiresAt: created.expiresAt,
      reused: false
    };
  }

  private buildValidatedImportRows(input: {
    rows: Record<string, string>[];
    headers: string[];
    sendInvitations: boolean;
  }) {
    const identifierColumn = this.resolveColumn(
      input.headers,
      headerAliases.identifier
    );
    const fullNameColumn = this.resolveColumn(input.headers, headerAliases.fullName);
    const emailColumn = this.resolveColumn(input.headers, headerAliases.email);
    const gerenciaColumn = this.resolveColumn(input.headers, headerAliases.gerencia);
    const centroColumn = this.resolveColumn(input.headers, headerAliases.centro);

    if (!identifierColumn) {
      throw new AppError(
        'No se encontró una columna de identificador',
        400,
        'RESPONDENT_IMPORT_IDENTIFIER_COLUMN_MISSING'
      );
    }

    const usedIdentifierKeys = new Set<string>();
    const errors: ImportRowError[] = [];
    const validRows: ValidImportRow[] = [];

    const excludedColumns = new Set(
      [identifierColumn, fullNameColumn, emailColumn, gerenciaColumn, centroColumn].filter(
        (value): value is string => Boolean(value)
      )
    );

    input.rows.forEach((source, index) => {
      const rowNumber = index + 2;
      const identifierRaw = normalizeOptionalText(source[identifierColumn]);
      const fullNameRaw = fullNameColumn ? normalizeOptionalText(source[fullNameColumn]) : null;
      const emailRaw = emailColumn ? normalizeOptionalText(source[emailColumn]) : null;
      const gerenciaRaw = gerenciaColumn
        ? normalizeOptionalText(source[gerenciaColumn])
        : null;
      const centroRaw = centroColumn ? normalizeOptionalText(source[centroColumn]) : null;

      const rowErrors: string[] = [];

      if (!identifierRaw) {
        rowErrors.push('Identificador requerido');
      }

      if (identifierRaw && identifierRaw.length > 160) {
        rowErrors.push('Identificador supera 160 caracteres');
      }

      if (emailRaw && !isValidEmail(emailRaw)) {
        rowErrors.push('Correo inválido');
      }

      if (input.sendInvitations && !emailRaw) {
        rowErrors.push('Correo requerido para enviar invitaciones');
      }

      if (rowErrors.length > 0) {
        errors.push({
          rowNumber,
          identifier: identifierRaw,
          errors: rowErrors
        });
        return;
      }

      let identifier = identifierRaw ?? '';
      let identifierKey = identifier.toLowerCase();

      while (usedIdentifierKeys.has(identifierKey)) {
        identifier = appendAccessCodeSuffix(identifierRaw ?? '');
        identifierKey = identifier.toLowerCase();
      }

      usedIdentifierKeys.add(identifierKey);

      const metadata: Record<string, string> = {};
      Object.entries(source).forEach(([header, value]) => {
        if (excludedColumns.has(header)) {
          return;
        }

        const normalizedValue = normalizeOptionalText(value);
        if (!normalizedValue) {
          return;
        }

        metadata[header] = normalizedValue;
      });

      validRows.push({
        rowNumber,
        identifier,
        identifierKey,
        fullName: fullNameRaw,
        email: emailRaw ? emailRaw.toLowerCase() : null,
        gerencia: gerenciaRaw,
        centro: centroRaw,
        metadata: Object.keys(metadata).length > 0 ? metadata : null
      });
    });

    return {
      validRows,
      errors
    };
  }

  private async sendInvitationMails(
    input: Array<{
      to: string;
      companyName: string;
      campaignName: string;
      campaignSlug: string;
      magicLinkToken: string;
      accessCode?: string;
      expiresAt: Date;
      respondentId: string;
    }>
  ) {
    const success: Array<{ respondentId: string }> = [];
    const failures: Array<{ respondentId: string; reason: string }> = [];
    const concurrency = Math.max(1, env.SURVEY_INVITATION_EMAIL_CONCURRENCY);
    const queue = [...input];
    const workers: Promise<void>[] = [];

    for (let i = 0; i < concurrency; i += 1) {
      workers.push(
        (async () => {
          while (queue.length > 0) {
            const current = queue.shift();
            if (!current) {
              return;
            }

            try {
              await this.sendInvitationWithRetry({
                respondentId: current.respondentId,
                to: current.to,
                companyName: current.companyName,
                campaignName: current.campaignName,
                campaignSlug: current.campaignSlug,
                magicLinkToken: current.magicLinkToken,
                ...(current.accessCode ? { accessCode: current.accessCode } : {}),
                expiresAt: current.expiresAt
              });
              success.push({ respondentId: current.respondentId });
            } catch (error) {
              logger.warn('survey_invitation_mail_failed', {
                respondentId: current.respondentId,
                campaignSlug: current.campaignSlug,
                reason: sanitizeErrorMessage(error)
              });
              failures.push({
                respondentId: current.respondentId,
                reason: sanitizeErrorMessage(error)
              });
            }
          }
        })()
      );
    }

    await Promise.all(workers);

    return {
      success,
      failures
    };
  }

  async importRespondents(
    companySlug: string,
    surveySlug: string,
    input: ImportSurveyRespondentsDto,
    principal: SessionPrincipal
  ) {
    this.assertCanManageSensitiveOperations(principal);
    const scope = await this.resolveScope(companySlug, surveySlug, principal);
    this.assertCampaignIsOpen(scope.campaign);

    const parsed = this.parseImportFile(input);
    const validation = this.buildValidatedImportRows({
      rows: parsed.rows,
      headers: parsed.headers,
      sendInvitations: input.sendInvitations
    });

    if (input.dryRun) {
      return {
        dryRun: true,
        summary: {
          totalRows: parsed.rows.length,
          validRows: validation.validRows.length,
          invalidRows: validation.errors.length
        },
        errors: validation.errors
      };
    }

    const expiresAt = this.getCredentialExpiry(scope.campaign, input.credentialExpiresAt);
    const shouldGenerateCredentials = input.generateCredentials;
    const shouldForceNewCredentials =
      input.regenerateCredentials || input.sendInvitations;

    const credentialsForEmail: Array<{
      respondentId: string;
      to: string;
      magicLinkToken: string;
      accessCode?: string;
      expiresAt: Date;
    }> = [];

    const credentialPreview: Array<{
      respondentId: string;
      identifier: string;
      credentialType: RespondentCredentialType;
      rawCredential?: string;
      expiresAt: Date;
      reused: boolean;
    }> = [];

    const createdRows: Array<{ respondentId: string; identifier: string; created: boolean }> = [];

    await prisma.$transaction(async (tx) => {
      const identifiers = validation.validRows.map((row) => row.identifier);
      const existingRespondents = await tx.respondent.findMany({
        where: {
          surveyCampaignId: scope.campaign.id,
          identifier: {
            in: identifiers
          }
        },
        select: {
          id: true,
          identifier: true,
          email: true
        }
      });

      const existingByIdentifier = new Map(
        existingRespondents.map((row) => [row.identifier?.toLowerCase() ?? '', row])
      );

      for (const row of validation.validRows) {
        const existing = existingByIdentifier.get(row.identifierKey);

        const persisted = existing
          ? await tx.respondent.update({
              where: {
                id: existing.id
              },
              data: {
                fullName: row.fullName,
                email: row.email,
                gerencia: row.gerencia,
                centro: row.centro,
                metadata: row.metadata ?? Prisma.JsonNull
              },
              select: {
                id: true,
                identifier: true,
                email: true
              }
            })
          : await tx.respondent.create({
              data: {
                companyId: scope.company.id,
                surveyCampaignId: scope.campaign.id,
                identifier: row.identifier,
                fullName: row.fullName,
                email: row.email,
                gerencia: row.gerencia,
                centro: row.centro,
                metadata: row.metadata ?? Prisma.JsonNull,
                isActive: true
              },
              select: {
                id: true,
                identifier: true,
                email: true
              }
            });

        createdRows.push({
          respondentId: persisted.id,
          identifier: persisted.identifier ?? row.identifier,
          created: !existing
        });

        if (!shouldGenerateCredentials) {
          continue;
        }

        const credential = await this.issueCredentialTx(tx, {
          respondentId: persisted.id,
          surveyCampaignId: scope.campaign.id,
          credentialType: input.credentialType,
          expiresAt,
          regenerate: shouldForceNewCredentials,
          accessCode: persisted.identifier ?? row.identifier
        });

        credentialPreview.push({
          respondentId: persisted.id,
          identifier: persisted.identifier ?? row.identifier,
          credentialType: credential.credentialType,
          ...(input.includeRawCredentials && credential.rawCredential
            ? { rawCredential: credential.rawCredential }
            : {}),
          expiresAt: credential.expiresAt,
          reused: credential.reused
        });

        if (input.sendInvitations && persisted.email && persisted.identifier) {
          const magicLinkCredential =
            credential.credentialType === RespondentCredentialType.TOKEN &&
            credential.rawCredential
              ? credential
              : await this.issueCredentialTx(tx, {
                  respondentId: persisted.id,
                  surveyCampaignId: scope.campaign.id,
                  credentialType: RespondentCredentialType.TOKEN,
                  expiresAt,
                  regenerate: true
                });

          if (!magicLinkCredential.rawCredential) {
            continue;
          }

          credentialsForEmail.push({
            respondentId: persisted.id,
            to: persisted.email,
            magicLinkToken: magicLinkCredential.rawCredential,
            ...(input.includeRawCredentials ? { accessCode: persisted.identifier } : {}),
            expiresAt: magicLinkCredential.expiresAt
          });
        }
      }
    });

    const invitationResult = input.sendInvitations
      ? await this.sendInvitationMails(
          credentialsForEmail.map((item) => ({
            ...item,
            companyName: scope.company.name,
            campaignName: scope.campaign.name,
            campaignSlug: scope.campaign.slug
          }))
        )
      : {
          success: [] as Array<{ respondentId: string }>,
          failures: [] as Array<{ respondentId: string; reason: string }>
        };

    return {
      dryRun: false,
      summary: {
        totalRows: parsed.rows.length,
        validRows: validation.validRows.length,
        invalidRows: validation.errors.length,
        createdRespondents: createdRows.filter((row) => row.created).length,
        updatedRespondents: createdRows.filter((row) => !row.created).length,
        credentialsGenerated: credentialPreview.length,
        invitationsSent: invitationResult.success.length,
        invitationFailures: invitationResult.failures.length
      },
      errors: validation.errors,
      credentials: credentialPreview,
      invitationFailures: invitationResult.failures
    };
  }

  async getOperationsSummary(
    companySlug: string,
    surveySlug: string,
    principal: SessionPrincipal
  ): Promise<SurveyOperationsSummaryResponse> {
    this.assertCanReadOperations(principal);
    const scope = await this.resolveScope(companySlug, surveySlug, principal);
    const now = new Date();

    const [
      totalRespondents,
      activeRespondents,
      respondentsWithEmail,
      latestRespondent,
      responseStatusRows,
      totalCredentials,
      activeCredentials,
      expiredCredentials,
      consumedCredentials,
      revokedCredentials,
      credentialTypeRows,
      latestCredential,
      reminderStatusRows,
      nextReminderSchedule,
      lastProcessedReminderSchedule
    ] = await Promise.all([
      prisma.respondent.count({
        where: {
          surveyCampaignId: scope.campaign.id
        }
      }),
      prisma.respondent.count({
        where: {
          surveyCampaignId: scope.campaign.id,
          isActive: true
        }
      }),
      prisma.respondent.count({
        where: {
          surveyCampaignId: scope.campaign.id,
          isActive: true,
          AND: [{ email: { not: null } }, { email: { not: '' } }]
        }
      }),
      prisma.respondent.findFirst({
        where: {
          surveyCampaignId: scope.campaign.id
        },
        orderBy: {
          updatedAt: 'desc'
        },
        select: {
          updatedAt: true
        }
      }),
      prisma.surveyResponse.groupBy({
        by: ['status'],
        where: {
          surveyCampaignId: scope.campaign.id,
          respondent: {
            isActive: true
          }
        },
        _count: {
          _all: true
        }
      }),
      prisma.respondentAccessCredential.count({
        where: {
          surveyCampaignId: scope.campaign.id
        }
      }),
      prisma.respondentAccessCredential.count({
        where: {
          surveyCampaignId: scope.campaign.id,
          consumedAt: null,
          revokedAt: null,
          expiresAt: {
            gt: now
          }
        }
      }),
      prisma.respondentAccessCredential.count({
        where: {
          surveyCampaignId: scope.campaign.id,
          consumedAt: null,
          revokedAt: null,
          expiresAt: {
            lte: now
          }
        }
      }),
      prisma.respondentAccessCredential.count({
        where: {
          surveyCampaignId: scope.campaign.id,
          consumedAt: {
            not: null
          }
        }
      }),
      prisma.respondentAccessCredential.count({
        where: {
          surveyCampaignId: scope.campaign.id,
          revokedAt: {
            not: null
          }
        }
      }),
      prisma.respondentAccessCredential.groupBy({
        by: ['credentialType'],
        where: {
          surveyCampaignId: scope.campaign.id
        },
        _count: {
          _all: true
        }
      }),
      prisma.respondentAccessCredential.findFirst({
        where: {
          surveyCampaignId: scope.campaign.id
        },
        orderBy: {
          createdAt: 'desc'
        },
        select: {
          createdAt: true
        }
      }),
      prisma.reminderSchedule.groupBy({
        by: ['status'],
        where: {
          surveyCampaignId: scope.campaign.id
        },
        _count: {
          _all: true
        }
      }),
      prisma.reminderSchedule.findFirst({
        where: {
          surveyCampaignId: scope.campaign.id,
          scheduledAt: {
            gte: now
          }
        },
        orderBy: {
          scheduledAt: 'asc'
        },
        select: {
          scheduledAt: true
        }
      }),
      prisma.reminderSchedule.findFirst({
        where: {
          surveyCampaignId: scope.campaign.id,
          processedAt: {
            not: null
          }
        },
        orderBy: {
          processedAt: 'desc'
        },
        select: {
          processedAt: true
        }
      })
    ]);

    const responseByStatus = {
      [SurveyResponseStatus.NOT_STARTED]: 0,
      [SurveyResponseStatus.IN_PROGRESS]: 0,
      [SurveyResponseStatus.SUBMITTED]: 0
    };

    for (const row of responseStatusRows) {
      responseByStatus[row.status] = row._count._all;
    }

    const observedNotStarted =
      responseByStatus[SurveyResponseStatus.NOT_STARTED];
    const inProgress = responseByStatus[SurveyResponseStatus.IN_PROGRESS];
    const submitted = responseByStatus[SurveyResponseStatus.SUBMITTED];
    const observedResponses = observedNotStarted + inProgress + submitted;
    const inferredNotStarted =
      activeRespondents > observedResponses
        ? activeRespondents - observedResponses
        : observedNotStarted;
    const notStarted = Math.max(0, inferredNotStarted);

    const credentialsByType = {
      TOKEN: 0,
      PIN: 0
    };

    for (const row of credentialTypeRows) {
      credentialsByType[row.credentialType] = row._count._all;
    }

    const reminderCounts = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0
    };

    for (const row of reminderStatusRows) {
      if (row.status === ReminderScheduleStatus.PENDING) {
        reminderCounts.pending = row._count._all;
      } else if (row.status === ReminderScheduleStatus.PROCESSING) {
        reminderCounts.processing = row._count._all;
      } else if (row.status === ReminderScheduleStatus.COMPLETED) {
        reminderCounts.completed = row._count._all;
      } else if (row.status === ReminderScheduleStatus.FAILED) {
        reminderCounts.failed = row._count._all;
      }
    }

    return {
      survey: {
        id: scope.campaign.id,
        slug: scope.campaign.slug,
        name: scope.campaign.name,
        status: scope.campaign.status,
        startDate: scope.campaign.startDate,
        endDate: scope.campaign.endDate
      },
      participants: {
        total: totalRespondents,
        active: activeRespondents,
        inactive: Math.max(0, totalRespondents - activeRespondents),
        withEmail: respondentsWithEmail,
        withoutEmail: Math.max(0, activeRespondents - respondentsWithEmail),
        lastImportedAt: latestRespondent?.updatedAt ?? null
      },
      responses: {
        notStarted,
        inProgress,
        submitted,
        completionRate:
          activeRespondents > 0
            ? Number((submitted / activeRespondents).toFixed(4))
            : 0
      },
      credentials: {
        totalIssued: totalCredentials,
        active: activeCredentials,
        expired: expiredCredentials,
        consumed: consumedCredentials,
        revoked: revokedCredentials,
        byType: credentialsByType,
        latestIssuedAt: latestCredential?.createdAt ?? null
      },
      reminders: {
        totalSchedules:
          reminderCounts.pending +
          reminderCounts.processing +
          reminderCounts.completed +
          reminderCounts.failed,
        pending: reminderCounts.pending,
        processing: reminderCounts.processing,
        completed: reminderCounts.completed,
        failed: reminderCounts.failed,
        nextScheduledAt: nextReminderSchedule?.scheduledAt ?? null,
        lastProcessedAt: lastProcessedReminderSchedule?.processedAt ?? null
      }
    };
  }

  async generateCredentials(
    companySlug: string,
    surveySlug: string,
    input: GenerateRespondentCredentialsDto,
    principal: SessionPrincipal
  ) {
    this.assertCanManageSensitiveOperations(principal);
    const scope = await this.resolveScope(companySlug, surveySlug, principal);
    this.assertCampaignIsOpen(scope.campaign);
    const expiresAt = this.getCredentialExpiry(scope.campaign, input.credentialExpiresAt);

    const respondents = await prisma.respondent.findMany({
      where: {
        surveyCampaignId: scope.campaign.id,
        isActive: true,
        ...(input.respondentIds?.length
          ? {
              id: {
                in: input.respondentIds
              }
            }
          : {})
      },
      select: {
        id: true,
        identifier: true,
        email: true
      }
    });

    if (respondents.length === 0) {
      return {
        summary: {
          respondents: 0,
          credentialsGenerated: 0,
          invitationsSent: 0,
          invitationFailures: 0
        },
        credentials: []
      };
    }

    const credentialPreview: Array<{
      respondentId: string;
      identifier: string | null;
      credentialType: RespondentCredentialType;
      rawCredential?: string;
      expiresAt: Date;
      reused: boolean;
    }> = [];

    const credentialsForEmail: Array<{
      respondentId: string;
      to: string;
      magicLinkToken: string;
      accessCode?: string;
      expiresAt: Date;
    }> = [];

    await prisma.$transaction(async (tx) => {
      for (const respondent of respondents) {
        const credential = await this.issueCredentialTx(tx, {
          respondentId: respondent.id,
          surveyCampaignId: scope.campaign.id,
          credentialType: input.credentialType,
          expiresAt,
          regenerate: input.regenerateCredentials || input.sendInvitations,
          accessCode: respondent.identifier
        });

        credentialPreview.push({
          respondentId: respondent.id,
          identifier: respondent.identifier,
          credentialType: credential.credentialType,
          ...(input.includeRawCredentials && credential.rawCredential
            ? { rawCredential: credential.rawCredential }
            : {}),
          expiresAt: credential.expiresAt,
          reused: credential.reused
        });

        if (input.sendInvitations && respondent.email && respondent.identifier) {
          const magicLinkCredential =
            credential.credentialType === RespondentCredentialType.TOKEN &&
            credential.rawCredential
              ? credential
              : await this.issueCredentialTx(tx, {
                  respondentId: respondent.id,
                  surveyCampaignId: scope.campaign.id,
                  credentialType: RespondentCredentialType.TOKEN,
                  expiresAt,
                  regenerate: true
                });

          if (!magicLinkCredential.rawCredential) {
            continue;
          }

          credentialsForEmail.push({
            respondentId: respondent.id,
            to: respondent.email,
            magicLinkToken: magicLinkCredential.rawCredential,
            ...(input.includeRawCredentials ? { accessCode: respondent.identifier } : {}),
            expiresAt: magicLinkCredential.expiresAt
          });
        }
      }
    });

    const invitationResult = input.sendInvitations
      ? await this.sendInvitationMails(
          credentialsForEmail.map((item) => ({
            ...item,
            companyName: scope.company.name,
            campaignName: scope.campaign.name,
            campaignSlug: scope.campaign.slug
          }))
        )
      : {
          success: [] as Array<{ respondentId: string }>,
          failures: [] as Array<{ respondentId: string; reason: string }>
        };

    return {
      summary: {
        respondents: respondents.length,
        credentialsGenerated: credentialPreview.length,
        invitationsSent: invitationResult.success.length,
        invitationFailures: invitationResult.failures.length
      },
      credentials: credentialPreview,
      invitationFailures: invitationResult.failures
    };
  }

  async sendInvitationsNow(
    companySlug: string,
    surveySlug: string,
    principal: SessionPrincipal
  ) {
    this.assertCanManageSensitiveOperations(principal);
    const scope = await this.resolveScope(companySlug, surveySlug, principal);
    this.assertCampaignIsOpen(scope.campaign);

    const expiresAt = this.getCredentialExpiry(scope.campaign);

    const respondents = await prisma.respondent.findMany({
      where: {
        surveyCampaignId: scope.campaign.id,
        isActive: true,
        email: { not: null }
      },
      select: {
        id: true,
        identifier: true,
        email: true
      }
    });

    if (respondents.length === 0) {
      return {
        summary: {
          respondents: 0,
          invitationsSent: 0,
          invitationFailures: 0
        }
      };
    }

    const credentialsForEmail: Array<{
      respondentId: string;
      to: string;
      magicLinkToken: string;
      accessCode: string;
      expiresAt: Date;
    }> = [];

    await prisma.$transaction(async (tx) => {
      for (const respondent of respondents) {
        if (!respondent.email) {
          continue;
        }

        const credential = await this.issueCredentialTx(tx, {
          respondentId: respondent.id,
          surveyCampaignId: scope.campaign.id,
          credentialType: RespondentCredentialType.TOKEN,
          expiresAt,
          regenerate: true
        });

        if (credential.rawCredential && respondent.identifier) {
          credentialsForEmail.push({
            respondentId: respondent.id,
            to: respondent.email,
            magicLinkToken: credential.rawCredential,
            accessCode: respondent.identifier,
            expiresAt: credential.expiresAt
          });
        }
      }
    });

    const invitationResult = await this.sendInvitationMails(
      credentialsForEmail.map((item) => ({
        ...item,
        companyName: scope.company.name,
        campaignName: scope.campaign.name,
        campaignSlug: scope.campaign.slug
      }))
    );

    return {
      summary: {
        respondents: respondents.length,
        invitationsSent: invitationResult.success.length,
        invitationFailures: invitationResult.failures.length
      }
    };
  }

  async createReminderSchedules(
    companySlug: string,
    surveySlug: string,
    input: CreateReminderSchedulesDto,
    principal: SessionPrincipal
  ) {
    this.assertCanManageSensitiveOperations(principal);
    const scope = await this.resolveScope(companySlug, surveySlug, principal);
    this.assertCampaignIsOpen(scope.campaign);

    const parsedDates = input.schedules
      .map((item) => parseDateTimeInput(item.scheduledAt))
      .map((date) => {
        if (Number.isNaN(date.getTime())) {
          throw new AppError(
            'Fecha de recordatorio inválida',
            400,
            'INVALID_REMINDER_SCHEDULE_DATE'
          );
        }

        if (date.getTime() <= Date.now()) {
          throw new AppError(
            'La fecha de recordatorio debe ser futura',
            400,
            'REMINDER_DATE_MUST_BE_FUTURE'
          );
        }

        if (date.getTime() > scope.campaign.endDate.getTime()) {
          throw new AppError(
            'La fecha de recordatorio excede el fin de la encuesta',
            400,
            'REMINDER_DATE_AFTER_CAMPAIGN_END'
          );
        }

        return date;
      });

    const deduplicated = parsedDates
      .sort((a, b) => a.getTime() - b.getTime())
      .filter((value, index, source) => {
        if (index === 0) {
          return true;
        }

        return value.getTime() !== source[index - 1]?.getTime();
      });

    const rows = await prisma.$transaction(async (tx) => {
      const result = [];

      for (const scheduledAt of deduplicated) {
        const schedule = await tx.reminderSchedule.upsert({
          where: {
            surveyCampaignId_scheduledAt: {
              surveyCampaignId: scope.campaign.id,
              scheduledAt
            }
          },
          update: {
            status: ReminderScheduleStatus.PENDING,
            nextRetryAt: null,
            lockToken: null
          },
          create: {
            surveyCampaignId: scope.campaign.id,
            scheduledAt,
            status: ReminderScheduleStatus.PENDING,
            createdByUserId: principal.id
          },
          select: {
            id: true,
            scheduledAt: true,
            status: true,
            createdAt: true
          }
        });

        result.push(schedule);
      }

      return result;
    });

    return {
      rows
    };
  }

  private async dispatchReminderToRespondent(input: {
    scheduleId: string;
    surveyCampaignId: string;
    campaignSlug: string;
    campaignName: string;
    companyName: string;
    respondent: {
      id: string;
      identifier: string | null;
      fullName: string | null;
      email: string | null;
    };
  }) {
    const now = new Date();
    const idempotencyKey = sha256(`${input.scheduleId}:${input.respondent.id}`);

    const dispatch = await prisma.reminderDispatch.upsert({
      where: {
        reminderScheduleId_respondentId: {
          reminderScheduleId: input.scheduleId,
          respondentId: input.respondent.id
        }
      },
      update: {},
      create: {
        reminderScheduleId: input.scheduleId,
        surveyCampaignId: input.surveyCampaignId,
        respondentId: input.respondent.id,
        idempotencyKey,
        status: ReminderDispatchStatus.PENDING
      }
    });

    if (
      dispatch.status === ReminderDispatchStatus.SENT ||
      dispatch.status === ReminderDispatchStatus.SKIPPED
    ) {
      return {
        status: dispatch.status
      };
    }

    if (dispatch.attemptCount >= REMINDER_DISPATCH_MAX_RETRIES) {
      return {
        status: ReminderDispatchStatus.FAILED
      };
    }

    if (!input.respondent.email) {
      await prisma.reminderDispatch.update({
        where: {
          id: dispatch.id
        },
        data: {
          status: ReminderDispatchStatus.SKIPPED,
          attemptCount: {
            increment: 1
          },
          lastAttemptAt: now,
          errorMessage: 'Respondent without email'
        }
      });

      return {
        status: ReminderDispatchStatus.SKIPPED
      };
    }

    if (!input.respondent.identifier) {
      await prisma.reminderDispatch.update({
        where: {
          id: dispatch.id
        },
        data: {
          status: ReminderDispatchStatus.SKIPPED,
          attemptCount: {
            increment: 1
          },
          lastAttemptAt: now,
          errorMessage: 'Respondent without identifier'
        }
      });

      return {
        status: ReminderDispatchStatus.SKIPPED
      };
    }

    const expiresAt = new Date(
      Math.min(
        Date.now() + env.REMINDER_CREDENTIAL_EXPIRES_HOURS * 60 * 60 * 1000,
        Date.now() + env.SURVEY_ACCESS_CREDENTIAL_EXPIRES_HOURS * 60 * 60 * 1000
      )
    );

    const issuedCredential = await prisma.$transaction(async (tx) => {
      const credential = await this.issueCredentialTx(tx, {
        respondentId: input.respondent.id,
        surveyCampaignId: input.surveyCampaignId,
        credentialType: RespondentCredentialType.TOKEN,
        expiresAt,
        regenerate: true
      });

      await tx.reminderDispatch.update({
        where: {
          id: dispatch.id
        },
        data: {
          status: ReminderDispatchStatus.PENDING,
          attemptCount: {
            increment: 1
          },
          lastAttemptAt: now,
          accessCredentialId: credential.credentialId,
          errorMessage: null
        }
      });

      return credential;
    });

    if (!issuedCredential.rawCredential) {
      await prisma.reminderDispatch.update({
        where: { id: dispatch.id },
        data: {
          status: ReminderDispatchStatus.FAILED,
          errorMessage: 'No raw credential available'
        }
      });

      return {
        status: ReminderDispatchStatus.FAILED
      };
    }

    try {
      await this.sendReminderWithRetry({
        respondentId: input.respondent.id,
        scheduleId: input.scheduleId,
        to: input.respondent.email,
        companyName: input.companyName,
        campaignName: input.campaignName,
        campaignSlug: input.campaignSlug,
        magicLinkToken: issuedCredential.rawCredential,
        accessCode: input.respondent.identifier,
        expiresAt: issuedCredential.expiresAt
      });

      await prisma.reminderDispatch.update({
        where: {
          id: dispatch.id
        },
        data: {
          status: ReminderDispatchStatus.SENT,
          sentAt: new Date(),
          errorMessage: null
        }
      });

      return {
        status: ReminderDispatchStatus.SENT
      };
    } catch (error) {
      await prisma.reminderDispatch.update({
        where: {
          id: dispatch.id
        },
        data: {
          status: ReminderDispatchStatus.FAILED,
          errorMessage: sanitizeErrorMessage(error)
        }
      });

      return {
        status: ReminderDispatchStatus.FAILED
      };
    }
  }

  private async processReminderSchedule(scheduleId: string) {
    const now = new Date();
    const claimed = await prisma.reminderSchedule.updateMany({
      where: {
        id: scheduleId,
        OR: [
          {
            status: ReminderScheduleStatus.PENDING
          },
          {
            status: ReminderScheduleStatus.FAILED,
            nextRetryAt: {
              lte: now
            }
          }
        ]
      },
      data: {
        status: ReminderScheduleStatus.PROCESSING,
        attemptCount: {
          increment: 1
        },
        lastAttemptAt: now,
        lockToken: randomToken(12)
      }
    });

    if (claimed.count === 0) {
      return {
        scheduleId,
        claimed: false,
        sent: 0,
        failed: 0,
        skipped: 0
      };
    }

    const schedule = await prisma.reminderSchedule.findUnique({
      where: {
        id: scheduleId
      },
      select: {
        id: true,
        surveyCampaignId: true,
        attemptCount: true,
        surveyCampaign: {
          select: {
            id: true,
            slug: true,
            name: true,
            company: {
              select: {
                name: true
              }
            }
          }
        }
      }
    });

    if (!schedule) {
      return {
        scheduleId,
        claimed: false,
        sent: 0,
        failed: 0,
        skipped: 0
      };
    }

    const respondents = await prisma.respondent.findMany({
      where: {
        surveyCampaignId: schedule.surveyCampaignId,
        isActive: true,
        OR: [{ response: null }, { response: { is: { submittedAt: null } } }]
      },
      select: {
        id: true,
        identifier: true,
        fullName: true,
        email: true
      }
    });

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const respondent of respondents) {
      const result = await this.dispatchReminderToRespondent({
        scheduleId: schedule.id,
        surveyCampaignId: schedule.surveyCampaignId,
        campaignSlug: schedule.surveyCampaign.slug,
        campaignName: schedule.surveyCampaign.name,
        companyName: schedule.surveyCampaign.company.name,
        respondent
      });

      if (result.status === ReminderDispatchStatus.SENT) {
        sent += 1;
      } else if (result.status === ReminderDispatchStatus.SKIPPED) {
        skipped += 1;
      } else if (result.status === ReminderDispatchStatus.FAILED) {
        failed += 1;
      }
    }

    if (failed > 0 && schedule.attemptCount < REMINDER_MAX_RETRIES) {
      const retryAt = new Date(Date.now() + REMINDER_RETRY_DELAY_SECONDS * 1000);
      await prisma.reminderSchedule.update({
        where: {
          id: schedule.id
        },
        data: {
          status: ReminderScheduleStatus.FAILED,
          nextRetryAt: retryAt
        }
      });

      await delay(30);
    } else {
      await prisma.reminderSchedule.update({
        where: {
          id: schedule.id
        },
        data: {
          status: ReminderScheduleStatus.COMPLETED,
          processedAt: new Date(),
          nextRetryAt: null
        }
      });
    }

    return {
      scheduleId: schedule.id,
      claimed: true,
      sent,
      failed,
      skipped
    };
  }

  async processDueReminderSchedules(input: { limit: number }) {
    const now = new Date();
    const dueSchedules = await prisma.reminderSchedule.findMany({
      where: {
        scheduledAt: {
          lte: now
        },
        OR: [
          {
            status: ReminderScheduleStatus.PENDING
          },
          {
            status: ReminderScheduleStatus.FAILED,
            nextRetryAt: {
              lte: now
            }
          }
        ]
      },
      orderBy: {
        scheduledAt: 'asc'
      },
      take: input.limit
    });

    const results = [];
    for (const schedule of dueSchedules) {
      const result = await this.processReminderSchedule(schedule.id);
      results.push(result);
    }

    return {
      processedSchedules: results.filter((item) => item.claimed).length,
      schedules: results
    };
  }

  async listRespondents(
    companySlug: string,
    surveySlug: string,
    principal: SessionPrincipal
  ) {
    this.assertCanManageSensitiveOperations(principal);
    const scope = await this.resolveScope(companySlug, surveySlug, principal);

    const respondents = await prisma.respondent.findMany({
      where: {
        surveyCampaignId: scope.campaign.id
      },
      select: {
        id: true,
        identifier: true,
        fullName: true,
        email: true,
        gerencia: true,
        centro: true,
        isActive: true,
        createdAt: true,
        response: {
          select: {
            status: true
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    return respondents.map((r) => ({
      id: r.id,
      identifier: r.identifier,
      fullName: r.fullName,
      email: r.email,
      gerencia: r.gerencia,
      centro: r.centro,
      isActive: r.isActive,
      invitedAt: r.createdAt,
      responseStatus: r.response?.status ?? null
    }));
  }
}
