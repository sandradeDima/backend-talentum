import { Router } from 'express';
import { Role } from '@prisma/client';
import { supportConfigController } from '../controllers/support-config.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const supportConfigRouter = Router();

supportConfigRouter.get(
  '/public',
  asyncHandler(supportConfigController.getPublic.bind(supportConfigController))
);

supportConfigRouter.get(
  '/public/:companySlug',
  asyncHandler(supportConfigController.getPublic.bind(supportConfigController))
);

supportConfigRouter.get(
  '/',
  requireAuth,
  requireRole([Role.ADMIN, Role.CLIENT_ADMIN]),
  asyncHandler(supportConfigController.get.bind(supportConfigController))
);

supportConfigRouter.put(
  '/',
  requireAuth,
  requireRole([Role.ADMIN, Role.CLIENT_ADMIN]),
  asyncHandler(supportConfigController.upsert.bind(supportConfigController))
);

export { supportConfigRouter };
