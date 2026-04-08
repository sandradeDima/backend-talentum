import { Router } from 'express';
import { surveyOperationsController } from '../controllers/survey-operations.controller';
import { rolePolicy } from '../lib/role-policy';
import { requireAdmin, requireAuth, requireRole } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const surveyOperationsRouter = Router({ mergeParams: true });

surveyOperationsRouter.get(
  '/operations/summary',
  requireAuth,
  requireRole(rolePolicy.adminAndClientAdmin),
  asyncHandler(
    surveyOperationsController.getOperationsSummary.bind(surveyOperationsController)
  )
);

surveyOperationsRouter.post(
  '/respondents/import',
  requireAuth,
  requireAdmin,
  asyncHandler(surveyOperationsController.importRespondents.bind(surveyOperationsController))
);

surveyOperationsRouter.post(
  '/respondents/credentials/generate',
  requireAuth,
  requireAdmin,
  asyncHandler(
    surveyOperationsController.generateCredentials.bind(surveyOperationsController)
  )
);

surveyOperationsRouter.post(
  '/respondents/invitations/send',
  requireAuth,
  requireAdmin,
  asyncHandler(
    surveyOperationsController.sendInvitationsNow.bind(surveyOperationsController)
  )
);

surveyOperationsRouter.post(
  '/reminder-schedules',
  requireAuth,
  requireAdmin,
  asyncHandler(
    surveyOperationsController.createReminderSchedules.bind(surveyOperationsController)
  )
);

surveyOperationsRouter.get(
  '/respondents',
  requireAuth,
  requireAdmin,
  asyncHandler(surveyOperationsController.listRespondents.bind(surveyOperationsController))
);

export { surveyOperationsRouter };
