import { ResourceLibraryItemType } from '@prisma/client';
import { z } from 'zod';

export const listResourceLibraryQueryDtoSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().min(1).max(180).optional(),
  companySlug: z.string().trim().min(2).max(120).optional(),
  itemType: z.nativeEnum(ResourceLibraryItemType).optional(),
  scope: z.enum(['all', 'global', 'company']).default('all'),
  status: z.enum(['active', 'inactive', 'all']).default('active')
});

const descriptionSchema = z.string().trim().max(4000);

export const createResourceLibraryItemDtoSchema = z.object({
  title: z.string().trim().min(3).max(180),
  description: descriptionSchema.optional(),
  url: z.string().trim().url().max(500),
  itemType: z.nativeEnum(ResourceLibraryItemType).default(ResourceLibraryItemType.LINK),
  companySlug: z.string().trim().min(2).max(120).optional(),
  metadata: z.record(z.unknown()).optional()
});

export const updateResourceLibraryItemDtoSchema = z
  .object({
    title: z.string().trim().min(3).max(180).optional(),
    description: descriptionSchema.optional(),
    url: z.string().trim().url().max(500).optional(),
    itemType: z.nativeEnum(ResourceLibraryItemType).optional(),
    companySlug: z.string().trim().min(2).max(120).nullable().optional(),
    isActive: z.boolean().optional(),
    metadata: z.record(z.unknown()).optional()
  })
  .superRefine((input, ctx) => {
    const hasAtLeastOneValue = Object.values(input).some((value) => typeof value !== 'undefined');

    if (!hasAtLeastOneValue) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Debes enviar al menos un campo para actualizar'
      });
    }
  });

export const resourceLibraryItemParamsDtoSchema = z.object({
  resourceId: z.string().trim().min(2).max(80)
});

export type ListResourceLibraryQueryDto = z.infer<typeof listResourceLibraryQueryDtoSchema>;
export type CreateResourceLibraryItemDto = z.infer<typeof createResourceLibraryItemDtoSchema>;
export type UpdateResourceLibraryItemDto = z.infer<typeof updateResourceLibraryItemDtoSchema>;
export type ResourceLibraryItemParamsDto = z.infer<typeof resourceLibraryItemParamsDtoSchema>;
