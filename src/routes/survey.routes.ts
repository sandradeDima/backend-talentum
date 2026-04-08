import { Router } from 'express';
import { Role } from '@prisma/client';
import { surveyController } from '../controllers/survey.controller';
import { requireAdmin, requireAuth, requireRole } from '../middlewares/auth.middleware';
import { surveyOperationsRouter } from './survey-operations.routes';
import { asyncHandler } from '../utils/asyncHandler';

const surveyRouter = Router({ mergeParams: true });

surveyRouter.get(
  '/',
  requireAuth,
  requireRole([Role.ADMIN, Role.CLIENT_ADMIN]),
  asyncHandler(surveyController.list.bind(surveyController))
);
surveyRouter.post(
  '/',
  requireAuth,
  requireAdmin,
  asyncHandler(surveyController.create.bind(surveyController))
);
surveyRouter.get(
  '/:surveySlug',
  requireAuth,
  requireRole([Role.ADMIN, Role.CLIENT_ADMIN]),
  asyncHandler(surveyController.getBySlug.bind(surveyController))
);
surveyRouter.put(
  '/:surveySlug',
  requireAuth,
  requireAdmin,
  asyncHandler(surveyController.update.bind(surveyController))
);
surveyRouter.post(
  '/:surveySlug/schedule-send',
  requireAuth,
  requireAdmin,
  asyncHandler(surveyController.scheduleInitialSend.bind(surveyController))
);
surveyRouter.post(
  '/:surveySlug/reminders',
  requireAuth,
  requireAdmin,
  asyncHandler(surveyController.configureReminders.bind(surveyController))
);
surveyRouter.post(
  '/:surveySlug/close',
  requireAuth,
  requireAdmin,
  asyncHandler(surveyController.closeCampaign.bind(surveyController))
);
surveyRouter.post(
  '/:surveySlug/finalize',
  requireAuth,
  requireAdmin,
  asyncHandler(surveyController.finalizeCampaign.bind(surveyController))
);
surveyRouter.use('/:surveySlug', surveyOperationsRouter);

export { surveyRouter };
