import { Router } from 'express';
import { Role } from '@prisma/client';
import { uploadController } from '../controllers/upload.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import { validateCompanyLogoUploadMiddleware } from '../middlewares/upload.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const uploadRouter = Router();

uploadRouter.post(
  '/company-logo',
  requireAuth,
  requireRole([Role.ADMIN, Role.CLIENT_ADMIN]),
  validateCompanyLogoUploadMiddleware,
  asyncHandler(uploadController.uploadCompanyLogo.bind(uploadController))
);

export { uploadRouter };
