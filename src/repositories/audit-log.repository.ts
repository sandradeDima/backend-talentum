import { randomUUID } from 'node:crypto';
import { Prisma, type AuditLogSeverity, type PrismaClient } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

const missingAuditColumns = ['severity', 'requestId', 'ipAddress', 'userAgent'] as const;

const isPrismaKnownRequestError = (
  error: unknown
): error is Prisma.PrismaClientKnownRequestError => {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code?: unknown }).code === 'string' &&
    'message' in error &&
    typeof (error as { message?: unknown }).message === 'string'
  );
};

const isMissingAuditColumnError = (error: unknown): error is Prisma.PrismaClientKnownRequestError => {
  return (
    isPrismaKnownRequestError(error) &&
    error.code === 'P2022' &&
    missingAuditColumns.some((column) => error.message.includes(`\`${column}\``))
  );
};

const errorCodeOf = (error: unknown): string | undefined => {
  if (isPrismaKnownRequestError(error)) {
    return error.code;
  }

  return undefined;
};

const errorMessageOf = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  if (isPrismaKnownRequestError(error)) {
    return error.message;
  }

  return String(error);
};

const serializeMetadataForFallback = (metadata: Prisma.InputJsonValue | undefined) => {
  if (typeof metadata === 'undefined') {
    return null;
  }

  try {
    return JSON.stringify(metadata);
  } catch {
    return null;
  }
};

export type AuditLogCreateInput = {
  actorUserId: string;
  action: string;
  severity?: AuditLogSeverity;
  companyId?: string;
  targetType?: string;
  targetId?: string;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Prisma.InputJsonValue;
};

export type AuditLogCreateResult = {
  persisted: boolean;
  fallbackUsed: boolean;
  errorCode?: string;
  errorMessage?: string;
};

export class AuditLogRepository {
  private async persistAudit(
    input: AuditLogCreateInput,
    tx: Prisma.TransactionClient | PrismaClient | undefined,
    options: { throwOnError: boolean }
  ): Promise<AuditLogCreateResult> {
    const db = tx ?? prisma;

    const handleFailure = (error: unknown): AuditLogCreateResult => {
      const failure = {
        persisted: false,
        fallbackUsed: false,
        errorCode: errorCodeOf(error),
        errorMessage: errorMessageOf(error)
      } satisfies AuditLogCreateResult;

      logger.error('audit_log_write_failed_non_blocking', {
        actorUserId: input.actorUserId,
        action: input.action,
        companyId: input.companyId ?? null,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        requestId: input.requestId ?? null,
        errorCode: failure.errorCode ?? null,
        errorMessage: failure.errorMessage
      });

      if (options.throwOnError) {
        throw error;
      }

      return failure;
    };

    try {
      await db.auditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: input.action,
          severity: input.severity,
          companyId: input.companyId,
          targetType: input.targetType,
          targetId: input.targetId,
          requestId: input.requestId,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          metadata: input.metadata
        }
      });

      return {
        persisted: true,
        fallbackUsed: false
      };
    } catch (error) {
      if (!isMissingAuditColumnError(error)) {
        return handleFailure(error);
      }

      logger.warn('audit_log_create_legacy_schema_fallback', {
        reason: error.message,
        actorUserId: input.actorUserId,
        action: input.action
      });

      try {
        await db.$executeRaw`
          INSERT INTO AuditLog (id, actorUserId, action, companyId, targetType, targetId, metadata)
          VALUES (
            ${randomUUID()},
            ${input.actorUserId},
            ${input.action},
            ${input.companyId ?? null},
            ${input.targetType ?? null},
            ${input.targetId ?? null},
            ${serializeMetadataForFallback(input.metadata)}
          )
        `;

        return {
          persisted: true,
          fallbackUsed: true
        };
      } catch (fallbackError) {
        return handleFailure(fallbackError);
      }
    }
  }

  async create(
    input: AuditLogCreateInput,
    tx?: Prisma.TransactionClient | PrismaClient
  ): Promise<AuditLogCreateResult> {
    // Default mode is best-effort to protect primary business flows.
    return this.persistAudit(input, tx, { throwOnError: false });
  }

  async createOrThrow(
    input: AuditLogCreateInput,
    tx?: Prisma.TransactionClient | PrismaClient
  ): Promise<AuditLogCreateResult> {
    // Strict mode is available for explicitly critical audit paths.
    return this.persistAudit(input, tx, { throwOnError: true });
  }
}
