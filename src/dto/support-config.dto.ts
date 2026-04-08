import { z } from 'zod';

const nullableUrlSchema = z
  .string()
  .trim()
  .optional()
  .transform((value, ctx) => {
    if (!value) {
      return null;
    }

    try {
      const url = new URL(value);
      return url.toString();
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'URL inválida'
      });
      return z.NEVER;
    }
  });

const nullableEmailSchema = z
  .string()
  .trim()
  .optional()
  .transform((value, ctx) => {
    if (!value) {
      return null;
    }

    const parsed = z.string().email().safeParse(value);
    if (!parsed.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Correo de soporte inválido'
      });
      return z.NEVER;
    }

    return value.toLowerCase();
  });

export const supportConfigQueryDtoSchema = z.object({
  companySlug: z.string().trim().min(2).max(120).optional()
});

export const upsertSupportConfigDtoSchema = z
  .object({
    companySlug: z.string().trim().min(2).max(120).optional(),
    whatsappLink: nullableUrlSchema,
    supportEmail: nullableEmailSchema,
    helpCenterUrl: nullableUrlSchema,
    enabled: z.boolean().optional().default(true)
  })
  .superRefine((input, ctx) => {
    if (input.enabled && !input.whatsappLink && !input.supportEmail && !input.helpCenterUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Debes configurar al menos un canal de soporte cuando está habilitado'
      });
    }
  });

export const publicSupportConfigParamsDtoSchema = z.object({
  companySlug: z.string().trim().min(2).max(120).optional()
});

export type SupportConfigQueryDto = z.infer<typeof supportConfigQueryDtoSchema>;
export type UpsertSupportConfigDto = z.infer<typeof upsertSupportConfigDtoSchema>;
export type PublicSupportConfigParamsDto = z.infer<typeof publicSupportConfigParamsDtoSchema>;
