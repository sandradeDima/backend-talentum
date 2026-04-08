import { z } from 'zod';

const nullableUrlSchema = z
  .string()
  .trim()
  .optional()
  .transform((value, ctx) => {
    if (!value) return null;
    try {
      return new URL(value).toString();
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'URL inválida' });
      return z.NEVER;
    }
  });

const nullableStringSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null));

const nullableEmailSchema = z
  .string()
  .trim()
  .optional()
  .transform((value, ctx) => {
    if (!value) return null;
    const parsed = z.string().email().safeParse(value);
    if (!parsed.success) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Correo inválido' });
      return z.NEVER;
    }
    return value.toLowerCase();
  });

export const upsertCoolturaConfigDtoSchema = z.object({
  linkedinUrl: nullableUrlSchema,
  youtubeUrl: nullableUrlSchema,
  instagramUrl: nullableUrlSchema,
  facebookUrl: nullableUrlSchema,
  tiktokUrl: nullableUrlSchema,
  whatsappLink: nullableUrlSchema,

  boliviaDireccion: nullableStringSchema,
  boliviaTelefono: nullableStringSchema,
  boliviaEmail: nullableEmailSchema,

  paraguayDireccion: nullableStringSchema,
  paraguayTelefono: nullableStringSchema,
  paraguayEmail: nullableEmailSchema
});

export type UpsertCoolturaConfigDto = z.infer<typeof upsertCoolturaConfigDtoSchema>;
