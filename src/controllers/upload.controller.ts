import type { Request, Response } from 'express';
import { AppError } from '../errors/appError';
import { successResponse } from '../utils/apiResponse';
import { uploadService } from '../lib/container';

export class UploadController {
  async uploadCompanyLogo(req: Request, res: Response) {
    if (!req.companyLogoUpload) {
      throw new AppError('Carga inválida de logo', 400, 'MISSING_UPLOAD_PAYLOAD');
    }

    const result = uploadService.saveCompanyLogo(req.companyLogoUpload);

    res.status(201).json(successResponse('Logo subido correctamente', result));
  }
}

export const uploadController = new UploadController();
