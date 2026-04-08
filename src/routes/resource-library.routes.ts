import { Router } from 'express';
import { Role } from '@prisma/client';
import { resourceLibraryController } from '../controllers/resource-library.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const resourceLibraryRouter = Router();

resourceLibraryRouter.get(
  '/meta/types',
  requireAuth,
  requireRole([Role.ADMIN, Role.CLIENT_ADMIN]),
  asyncHandler(resourceLibraryController.supportedTypes.bind(resourceLibraryController))
);

resourceLibraryRouter.get(
  '/',
  requireAuth,
  requireRole([Role.ADMIN, Role.CLIENT_ADMIN]),
  asyncHandler(resourceLibraryController.list.bind(resourceLibraryController))
);

resourceLibraryRouter.post(
  '/',
  requireAuth,
  requireRole([Role.ADMIN, Role.CLIENT_ADMIN]),
  asyncHandler(resourceLibraryController.create.bind(resourceLibraryController))
);

resourceLibraryRouter.get(
  '/:resourceId',
  requireAuth,
  requireRole([Role.ADMIN, Role.CLIENT_ADMIN]),
  asyncHandler(resourceLibraryController.getById.bind(resourceLibraryController))
);

resourceLibraryRouter.put(
  '/:resourceId',
  requireAuth,
  requireRole([Role.ADMIN, Role.CLIENT_ADMIN]),
  asyncHandler(resourceLibraryController.update.bind(resourceLibraryController))
);

resourceLibraryRouter.delete(
  '/:resourceId',
  requireAuth,
  requireRole([Role.ADMIN, Role.CLIENT_ADMIN]),
  asyncHandler(resourceLibraryController.deactivate.bind(resourceLibraryController))
);

export { resourceLibraryRouter };
