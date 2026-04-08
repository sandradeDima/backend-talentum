import { Router } from 'express';
import { Role } from '@prisma/client';
import { coolturaConfigController } from '../controllers/cooltura-config.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const coolturaConfigRouter = Router();

coolturaConfigRouter.get(
  '/',
  requireAuth,
  requireRole([Role.ADMIN]),
  asyncHandler(coolturaConfigController.get.bind(coolturaConfigController))
);

coolturaConfigRouter.put(
  '/',
  requireAuth,
  requireRole([Role.ADMIN]),
  asyncHandler(coolturaConfigController.upsert.bind(coolturaConfigController))
);

export { coolturaConfigRouter };
