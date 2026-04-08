import {
  publicSurveyBrandingParamsDtoSchema,
  validateSurveyAccessDtoSchema,
  type PublicSurveyBrandingParamsDto,
  type ValidateSurveyAccessDto
} from '../dto/survey-access.dto';

export const validateSurveyAccess = (input: unknown): ValidateSurveyAccessDto => {
  return validateSurveyAccessDtoSchema.parse(input);
};

export const validatePublicSurveyBrandingParams = (
  input: unknown
): PublicSurveyBrandingParamsDto => {
  return publicSurveyBrandingParamsDtoSchema.parse(input);
};
