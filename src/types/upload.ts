export type CompanyLogoUploadPayload = {
  fileName?: string;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';
  base64: string;
};
