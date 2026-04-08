import { Role, UserActivationStatus } from '@prisma/client';
import { z } from 'zod';

const phoneSchema = z
  .string()
  .trim()
  .min(6, 'El teléfono debe tener al menos 6 caracteres')
  .max(40, 'El teléfono no puede superar 40 caracteres');

const companyAdminRoleSchema = z.literal(Role.CLIENT_ADMIN);

export const createCompanyUserDtoSchema = z.object({
  name: z.string().trim().min(2).max(120),
  lastName: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  phone: phoneSchema,
  role: companyAdminRoleSchema.optional().default(Role.CLIENT_ADMIN)
});

export const updateCompanyUserDtoSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    lastName: z.string().trim().min(2).max(120).optional(),
    email: z.string().trim().email().optional(),
    phone: phoneSchema.optional(),
    role: companyAdminRoleSchema.optional(),
    activationStatus: z.nativeEnum(UserActivationStatus).optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Debes enviar al menos un campo para actualizar'
  });

export const listGlobalCompanyUsersQueryDtoSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().trim().optional(),
  company: z.string().trim().optional(),
  activationStatus: z.nativeEnum(UserActivationStatus).optional()
});

export type CreateCompanyUserDto = z.infer<typeof createCompanyUserDtoSchema>;
export type UpdateCompanyUserDto = z.infer<typeof updateCompanyUserDtoSchema>;
export type ListGlobalCompanyUsersQueryDto = z.infer<
  typeof listGlobalCompanyUsersQueryDtoSchema
>;
