import { z } from 'zod';

const invitationPasswordSchema = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(128, 'La contraseña no puede superar 128 caracteres')
  .regex(/[a-z]/, 'La contraseña debe incluir al menos una letra minúscula')
  .regex(/[A-Z]/, 'La contraseña debe incluir al menos una letra mayúscula')
  .regex(/\d/, 'La contraseña debe incluir al menos un número')
  .regex(/[^A-Za-z0-9]/, 'La contraseña debe incluir al menos un símbolo');

export const acceptInvitationDtoSchema = z.object({
  token: z.string().min(20),
  name: z.string().min(2).max(120),
  password: invitationPasswordSchema
});

export const validateInvitationTokenDtoSchema = z.object({
  token: z.string().min(20).max(256)
});

export type AcceptInvitationDto = z.infer<typeof acceptInvitationDtoSchema>;
export type ValidateInvitationTokenDto = z.infer<typeof validateInvitationTokenDtoSchema>;
