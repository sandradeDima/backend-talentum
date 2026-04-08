import { RespondentCredentialType } from '@prisma/client';
import { z } from 'zod';

export const respondentImportMimeTypeSchema = z.enum([
  'text/csv',
  'application/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]);

export const importSurveyRespondentsDtoSchema = z
  .object({
    fileName: z.string().trim().min(3).max(220),
    mimeType: respondentImportMimeTypeSchema,
    base64: z.string().min(20),
    dryRun: z.boolean().optional().default(false),
    generateCredentials: z.boolean().optional().default(true),
    credentialType: z
      .nativeEnum(RespondentCredentialType)
      .optional()
      .default(RespondentCredentialType.TOKEN),
    credentialExpiresAt: z.string().trim().min(1).optional(),
    regenerateCredentials: z.boolean().optional().default(false),
    sendInvitations: z.boolean().optional().default(false),
    includeRawCredentials: z.boolean().optional().default(false)
  })
  .superRefine((input, ctx) => {
    if (input.dryRun && input.sendInvitations) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sendInvitations'],
        message: 'No se pueden enviar invitaciones en modo dryRun'
      });
    }
  });

export const generateRespondentCredentialsDtoSchema = z.object({
  respondentIds: z.array(z.string().min(2).max(80)).max(10000).optional(),
  credentialType: z
    .nativeEnum(RespondentCredentialType)
    .optional()
    .default(RespondentCredentialType.TOKEN),
  credentialExpiresAt: z.string().trim().min(1).optional(),
  regenerateCredentials: z.boolean().optional().default(true),
  sendInvitations: z.boolean().optional().default(false),
  includeRawCredentials: z.boolean().optional().default(false)
});

export const createReminderSchedulesDtoSchema = z.object({
  schedules: z
    .array(
      z.object({
        scheduledAt: z.string().trim().min(1)
      })
    )
    .min(1)
    .max(100)
});

export const runReminderWorkerNowDtoSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(10)
});

export type ImportSurveyRespondentsDto = z.infer<typeof importSurveyRespondentsDtoSchema>;
export type GenerateRespondentCredentialsDto = z.infer<
  typeof generateRespondentCredentialsDtoSchema
>;
export type CreateReminderSchedulesDto = z.infer<typeof createReminderSchedulesDtoSchema>;
export type RunReminderWorkerNowDto = z.infer<typeof runReminderWorkerNowDtoSchema>;
