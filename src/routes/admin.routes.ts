import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { requireAdmin, requireAuth } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const adminRouter = Router();

adminRouter.get(
  '/users',
  requireAuth,
  requireAdmin,
  asyncHandler(adminController.listUsers.bind(adminController))
);

adminRouter.get(
  '/surveys',
  requireAuth,
  requireAdmin,
  asyncHandler(adminController.listSurveys.bind(adminController))
);
adminRouter.post(
  '/reminders/run-due',
  requireAuth,
  requireAdmin,
  asyncHandler(adminController.runDueReminders.bind(adminController))
);

export { adminRouter };
