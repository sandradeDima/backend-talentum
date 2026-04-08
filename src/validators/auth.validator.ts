import {
  type LoginDto,
  type SocialFinalizeDto,
  type SocialProviderDto,
  type SocialSignInStartDto,
  loginDtoSchema,
  socialFinalizeDtoSchema,
  socialProviderSchema,
  socialSignInStartDtoSchema
} from '../dto/auth.dto';

export const validateLogin = (input: unknown): LoginDto => {
  return loginDtoSchema.parse(input);
};

export const validateSocialProvider = (input: unknown): SocialProviderDto => {
  return socialProviderSchema.parse(input);
};

export const validateSocialSignInStart = (input: unknown): SocialSignInStartDto => {
  return socialSignInStartDtoSchema.parse(input);
};

export const validateSocialFinalize = (input: unknown): SocialFinalizeDto => {
  return socialFinalizeDtoSchema.parse(input ?? {});
};
