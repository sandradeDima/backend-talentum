import { RespondentCredentialType } from '@prisma/client';
import { z } from 'zod';

export const validateSurveyAccessDtoSchema = z
  .object({
    campaignSlug: z.string().trim().min(2).max(160),
    credentialType: z.nativeEnum(RespondentCredentialType),
    credential: z.string().trim().min(4).max(512),
    respondentIdentifier: z.string().trim().min(1).max(160).optional()
  });

export type ValidateSurveyAccessDto = z.infer<typeof validateSurveyAccessDtoSchema>;

export const publicSurveyBrandingParamsDtoSchema = z.object({
  campaignSlug: z.string().trim().min(2).max(160)
});

export type PublicSurveyBrandingParamsDto = z.infer<
  typeof publicSurveyBrandingParamsDtoSchema
>;
