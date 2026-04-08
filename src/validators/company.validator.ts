import {
  createCompanyDtoSchema,
  listCompaniesQueryDtoSchema,
  suggestCompanySlugDtoSchema,
  type CreateCompanyDto,
  type ListCompaniesQueryDto,
  type SuggestCompanySlugDto,
  type UpdateCompanyDto,
  updateCompanyDtoSchema
} from '../dto/company.dto';

export const validateCreateCompany = (input: unknown): CreateCompanyDto => {
  return createCompanyDtoSchema.parse(input);
};

export const validateUpdateCompany = (input: unknown): UpdateCompanyDto => {
  return updateCompanyDtoSchema.parse(input);
};

export const validateListCompaniesQuery = (input: unknown): ListCompaniesQueryDto => {
  return listCompaniesQueryDtoSchema.parse(input);
};

export const validateSuggestCompanySlug = (input: unknown): SuggestCompanySlugDto => {
  return suggestCompanySlugDtoSchema.parse(input);
};
