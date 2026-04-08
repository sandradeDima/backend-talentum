import {
  createCompanyUserDtoSchema,
  listGlobalCompanyUsersQueryDtoSchema,
  updateCompanyUserDtoSchema,
  type CreateCompanyUserDto,
  type ListGlobalCompanyUsersQueryDto,
  type UpdateCompanyUserDto
} from '../dto/company-user.dto';

export const validateCreateCompanyUser = (input: unknown): CreateCompanyUserDto => {
  return createCompanyUserDtoSchema.parse(input);
};

export const validateUpdateCompanyUser = (input: unknown): UpdateCompanyUserDto => {
  return updateCompanyUserDtoSchema.parse(input);
};

export const validateListGlobalCompanyUsersQuery = (
  input: unknown
): ListGlobalCompanyUsersQueryDto => {
  return listGlobalCompanyUsersQueryDtoSchema.parse(input);
};
