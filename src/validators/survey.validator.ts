import {
  configureSurveyRemindersDtoSchema,
  createSurveyCampaignDtoSchema,
  listGlobalSurveyCampaignsQueryDtoSchema,
  scheduleSurveySendDtoSchema,
  updateSurveyCampaignDtoSchema,
  type ConfigureSurveyRemindersDto,
  type CreateSurveyCampaignDto,
  type ListGlobalSurveyCampaignsQueryDto,
  type ScheduleSurveySendDto,
  type UpdateSurveyCampaignDto
} from '../dto/survey.dto';

export const validateCreateSurveyCampaign = (input: unknown): CreateSurveyCampaignDto => {
  return createSurveyCampaignDtoSchema.parse(input);
};

export const validateUpdateSurveyCampaign = (input: unknown): UpdateSurveyCampaignDto => {
  return updateSurveyCampaignDtoSchema.parse(input);
};

export const validateScheduleSurveySend = (input: unknown): ScheduleSurveySendDto => {
  return scheduleSurveySendDtoSchema.parse(input);
};

export const validateConfigureSurveyReminders = (
  input: unknown
): ConfigureSurveyRemindersDto => {
  return configureSurveyRemindersDtoSchema.parse(input);
};

export const validateListGlobalSurveyCampaignsQuery = (
  input: unknown
): ListGlobalSurveyCampaignsQueryDto => {
  return listGlobalSurveyCampaignsQueryDtoSchema.parse(input);
};
