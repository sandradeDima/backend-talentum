import { CompanyStatus } from '@prisma/client';
import { z } from 'zod';

const logoUrlSchema = z
  .string()
  .trim()
  .refine((value) => {
    if (!value) {
      return false;
    }

    if (value.startsWith('/')) {
      return true;
    }

    return z.string().url().safeParse(value).success;
  }, 'Invalid url');

export const createCompanyDtoSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().min(2).max(120),
  logoUrl: logoUrlSchema.optional(),
  supportWhatsappPhone: z.string().trim().min(6).max(50).optional(),
  workerCount: z.coerce.number().int().positive(),
  contactEmail: z.string().email()
});

export const updateCompanyDtoSchema = z
  .object({
    name: z.string().min(2).max(120).optional(),
    slug: z.string().min(2).max(120).optional(),
    logoUrl: logoUrlSchema.nullable().optional(),
    supportWhatsappPhone: z.string().trim().min(6).max(50).nullable().optional(),
    workerCount: z.coerce.number().int().positive().optional(),
    contactEmail: z.string().email().optional(),
    status: z.nativeEnum(CompanyStatus).optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Debes enviar al menos un campo para actualizar'
  });

export const listCompaniesQueryDtoSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().trim().optional(),
  status: z.nativeEnum(CompanyStatus).optional()
});

export const suggestCompanySlugDtoSchema = z.object({
  slug: z.string().trim().min(2).max(120),
  excludeSlug: z.string().trim().min(2).max(120).optional()
});

export type CreateCompanyDto = z.infer<typeof createCompanyDtoSchema>;
export type UpdateCompanyDto = z.infer<typeof updateCompanyDtoSchema>;
export type ListCompaniesQueryDto = z.infer<typeof listCompaniesQueryDtoSchema>;
export type SuggestCompanySlugDto = z.infer<typeof suggestCompanySlugDtoSchema>;
