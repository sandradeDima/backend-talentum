import {
  createResourceLibraryItemDtoSchema,
  listResourceLibraryQueryDtoSchema,
  resourceLibraryItemParamsDtoSchema,
  updateResourceLibraryItemDtoSchema,
  type CreateResourceLibraryItemDto,
  type ListResourceLibraryQueryDto,
  type ResourceLibraryItemParamsDto,
  type UpdateResourceLibraryItemDto
} from '../dto/resource-library.dto';

export const validateListResourceLibraryQuery = (input: unknown): ListResourceLibraryQueryDto => {
  return listResourceLibraryQueryDtoSchema.parse(input);
};

export const validateCreateResourceLibraryItem = (
  input: unknown
): CreateResourceLibraryItemDto => {
  return createResourceLibraryItemDtoSchema.parse(input);
};

export const validateUpdateResourceLibraryItem = (
  input: unknown
): UpdateResourceLibraryItemDto => {
  return updateResourceLibraryItemDtoSchema.parse(input);
};

export const validateResourceLibraryItemParams = (
  input: unknown
): ResourceLibraryItemParamsDto => {
  return resourceLibraryItemParamsDtoSchema.parse(input);
};
