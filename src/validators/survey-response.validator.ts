import {
  autosaveSurveyResponseDtoSchema,
  startSurveyResponseDtoSchema,
  submitSurveyResponseDtoSchema,
  type AutosaveSurveyResponseDto,
  type StartSurveyResponseDto,
  type SubmitSurveyResponseDto
} from '../dto/survey-response.dto';

export const validateStartSurveyResponse = (input: unknown): StartSurveyResponseDto => {
  return startSurveyResponseDtoSchema.parse(input);
};

export const validateAutosaveSurveyResponse = (input: unknown): AutosaveSurveyResponseDto => {
  return autosaveSurveyResponseDtoSchema.parse(input);
};

export const validateSubmitSurveyResponse = (input: unknown): SubmitSurveyResponseDto => {
  return submitSurveyResponseDtoSchema.parse(input);
};
