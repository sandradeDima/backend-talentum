import { Router } from 'express';
import { Role } from '@prisma/client';
import { companyUserController } from '../controllers/company-user.controller';
import { requireAdmin, requireAuth, requireRole } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const companyUserRouter = Router({ mergeParams: true });

companyUserRouter.get(
  '/',
  requireAuth,
  requireRole([Role.ADMIN, Role.CLIENT_ADMIN]),
  asyncHandler(companyUserController.list.bind(companyUserController))
);
companyUserRouter.post(
  '/',
  requireAuth,
  requireAdmin,
  asyncHandler(companyUserController.create.bind(companyUserController))
);
companyUserRouter.put(
  '/:userId',
  requireAuth,
  requireAdmin,
  asyncHandler(companyUserController.update.bind(companyUserController))
);
companyUserRouter.patch(
  '/:userId/deactivate',
  requireAuth,
  requireAdmin,
  asyncHandler(companyUserController.deactivate.bind(companyUserController))
);
companyUserRouter.post(
  '/:userId/reset-password',
  requireAuth,
  requireAdmin,
  asyncHandler(companyUserController.resetPassword.bind(companyUserController))
);
companyUserRouter.post(
  '/:userId/resend-invite',
  requireAuth,
  requireAdmin,
  asyncHandler(companyUserController.resendInvite.bind(companyUserController))
);

export { companyUserRouter };
