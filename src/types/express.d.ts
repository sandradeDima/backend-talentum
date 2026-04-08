import type { SessionPayload } from './auth';
import type { CompanyLogoUploadPayload } from './upload';

declare global {
  namespace Express {
    interface Request {
      authSession?: SessionPayload;
      companyLogoUpload?: CompanyLogoUploadPayload;
      requestId?: string;
      requestStartedAt?: number;
    }
  }
}

export {};
