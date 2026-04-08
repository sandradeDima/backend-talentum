import { SurveyCampaignStatus, SurveyTemplateKey } from '@prisma/client';
import { z } from 'zod';

const surveyDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)');

const nonEmptyTextSchema = z.string().trim().min(1, 'Este campo es obligatorio');

const sectionQuestionsSchema = z
  .array(nonEmptyTextSchema)
  .length(6, 'Cada sección debe tener exactamente 6 preguntas base');

const optionalExtraQuestionSchema = z
  .string()
  .trim()
  .nullable()
  .optional();

const optionalTutorialVideoUrlSchema = z
  .string()
  .trim()
  .url('Debes ingresar una URL válida para el tutorial')
  .nullable()
  .optional();

export const createSurveyCampaignDtoSchema = z.object({
  templateKey: z.nativeEnum(SurveyTemplateKey).default(SurveyTemplateKey.BASE_CLIMA_V1),
  name: z.string().trim().min(2).max(160),
  startDate: surveyDateSchema,
  endDate: surveyDateSchema,
  introGeneral: nonEmptyTextSchema,
  leaderIntro: nonEmptyTextSchema,
  leaderQuestions: sectionQuestionsSchema,
  leaderExtraQuestion: optionalExtraQuestionSchema,
  teamIntro: nonEmptyTextSchema,
  teamQuestions: sectionQuestionsSchema,
  teamExtraQuestion: optionalExtraQuestionSchema,
  organizationIntro: nonEmptyTextSchema,
  organizationQuestions: sectionQuestionsSchema,
  organizationExtraQuestion: optionalExtraQuestionSchema,
  finalNpsQuestion: nonEmptyTextSchema,
  finalOpenQuestion: nonEmptyTextSchema,
  closingText: nonEmptyTextSchema,
  tutorialVideoUrl: optionalTutorialVideoUrlSchema
});

export const updateSurveyCampaignDtoSchema = createSurveyCampaignDtoSchema;

export const scheduleSurveySendDtoSchema = z.object({
  scheduledAt: z.string().min(1, 'Debes seleccionar fecha y hora de envío inicial')
});

export const configureSurveyRemindersDtoSchema = z.object({
  reminders: z
    .array(
      z.object({
        scheduledAt: z.string().min(1, 'Debes seleccionar fecha y hora del recordatorio')
      })
    )
    .min(1, 'Debes programar al menos un recordatorio')
    .max(20, 'Máximo 20 recordatorios por configuración')
});

export const listGlobalSurveyCampaignsQueryDtoSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().trim().optional(),
  company: z.string().trim().optional(),
  status: z.nativeEnum(SurveyCampaignStatus).optional()
});

export type CreateSurveyCampaignDto = z.infer<typeof createSurveyCampaignDtoSchema>;
export type UpdateSurveyCampaignDto = z.infer<typeof updateSurveyCampaignDtoSchema>;
export type ScheduleSurveySendDto = z.infer<typeof scheduleSurveySendDtoSchema>;
export type ConfigureSurveyRemindersDto = z.infer<typeof configureSurveyRemindersDtoSchema>;
export type ListGlobalSurveyCampaignsQueryDto = z.infer<
  typeof listGlobalSurveyCampaignsQueryDtoSchema
>;
