import { Router } from 'express';
import { dashboardController } from '../controllers/dashboard.controller';
import { rolePolicy } from '../lib/role-policy';
import { requireAdmin, requireAuth, requireRole } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const dashboardRouter = Router();

dashboardRouter.get(
  '/progress',
  requireAuth,
  requireRole(rolePolicy.adminAndClientAdmin),
  asyncHandler(dashboardController.getProgress.bind(dashboardController))
);

dashboardRouter.get(
  '/results',
  requireAuth,
  requireRole(rolePolicy.adminAndClientAdmin),
  asyncHandler(dashboardController.getResults.bind(dashboardController))
);

dashboardRouter.post(
  '/results/export',
  requireAuth,
  requireAdmin,
  asyncHandler(dashboardController.createExportJob.bind(dashboardController))
);

dashboardRouter.get(
  '/results/export',
  requireAuth,
  requireRole(rolePolicy.adminAndClientAdmin),
  asyncHandler(dashboardController.listExportJobs.bind(dashboardController))
);

dashboardRouter.get(
  '/results/export/:jobId',
  requireAuth,
  requireRole(rolePolicy.adminAndClientAdmin),
  asyncHandler(dashboardController.getExportJob.bind(dashboardController))
);

dashboardRouter.get(
  '/results/export/:jobId/download',
  requireAuth,
  requireAdmin,
  asyncHandler(dashboardController.downloadExportJob.bind(dashboardController))
);

dashboardRouter.post(
  '/results/export/run-due',
  requireAuth,
  requireAdmin,
  asyncHandler(dashboardController.runDueExports.bind(dashboardController))
);

export { dashboardRouter };
