import { z } from 'zod';

const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;

export const uploadCompanyLogoDtoSchema = z.object({
  fileName: z.string().min(1).max(200).optional(),
  mimeType: z.enum(allowedMimeTypes),
  base64: z.string().min(20)
});

export type UploadCompanyLogoDto = z.infer<typeof uploadCompanyLogoDtoSchema>;
