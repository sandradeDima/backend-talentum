import { z } from 'zod';

export const loginDtoSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  companySlug: z.string().min(2).max(80).optional(),
  rememberMe: z.boolean().optional()
});

export const socialProviderSchema = z.enum(['google', 'microsoft']);

export const socialSignInStartDtoSchema = z.object({
  companySlug: z.string().min(2).max(80).optional()
});

export const socialFinalizeDtoSchema = z.object({
  companySlug: z.string().min(2).max(80).optional()
});

export const emptyDtoSchema = z.object({}).strict();

export type LoginDto = z.infer<typeof loginDtoSchema>;
export type SocialProviderDto = z.infer<typeof socialProviderSchema>;
export type SocialSignInStartDto = z.infer<typeof socialSignInStartDtoSchema>;
export type SocialFinalizeDto = z.infer<typeof socialFinalizeDtoSchema>;
