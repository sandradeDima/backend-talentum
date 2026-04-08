import {
  createReminderSchedulesDtoSchema,
  generateRespondentCredentialsDtoSchema,
  importSurveyRespondentsDtoSchema,
  runReminderWorkerNowDtoSchema,
  type CreateReminderSchedulesDto,
  type GenerateRespondentCredentialsDto,
  type ImportSurveyRespondentsDto,
  type RunReminderWorkerNowDto
} from '../dto/survey-operations.dto';

export const validateImportSurveyRespondents = (
  input: unknown
): ImportSurveyRespondentsDto => {
  return importSurveyRespondentsDtoSchema.parse(input);
};

export const validateGenerateRespondentCredentials = (
  input: unknown
): GenerateRespondentCredentialsDto => {
  return generateRespondentCredentialsDtoSchema.parse(input);
};

export const validateCreateReminderSchedules = (
  input: unknown
): CreateReminderSchedulesDto => {
  return createReminderSchedulesDtoSchema.parse(input);
};

export const validateRunReminderWorkerNow = (input: unknown): RunReminderWorkerNowDto => {
  return runReminderWorkerNowDtoSchema.parse(input);
};
