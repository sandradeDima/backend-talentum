import type { NextFunction, Request, Response } from 'express';
import { validateUploadCompanyLogo } from '../validators/upload.validator';

export const validateCompanyLogoUploadMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  req.companyLogoUpload = validateUploadCompanyLogo(req.body);
  next();
};
