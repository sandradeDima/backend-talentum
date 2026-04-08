import {
  publicSupportConfigParamsDtoSchema,
  supportConfigQueryDtoSchema,
  upsertSupportConfigDtoSchema,
  type PublicSupportConfigParamsDto,
  type SupportConfigQueryDto,
  type UpsertSupportConfigDto
} from '../dto/support-config.dto';

export const validateSupportConfigQuery = (input: unknown): SupportConfigQueryDto => {
  return supportConfigQueryDtoSchema.parse(input);
};

export const validateUpsertSupportConfig = (input: unknown): UpsertSupportConfigDto => {
  return upsertSupportConfigDtoSchema.parse(input);
};

export const validatePublicSupportConfigParams = (
  input: unknown
): PublicSupportConfigParamsDto => {
  return publicSupportConfigParamsDtoSchema.parse(input);
};
