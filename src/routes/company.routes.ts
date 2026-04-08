import { Router } from 'express';
import { companyController } from '../controllers/company.controller';
import {
  requireAdmin,
  requireAuth,
  requireCompanyAccess,
  requireRole
} from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { Role } from '@prisma/client';
import { surveyRouter } from './survey.routes';
import { companyUserRouter } from './company-user.routes';

const companyRouter = Router();

companyRouter.post('/', requireAuth, requireAdmin, asyncHandler(companyController.create.bind(companyController)));
companyRouter.get(
  '/slug-suggestions',
  requireAuth,
  requireAdmin,
  asyncHandler(companyController.suggestSlug.bind(companyController))
);
companyRouter.get(
  '/',
  requireAuth,
  requireRole([Role.ADMIN, Role.CLIENT_ADMIN]),
  asyncHandler(companyController.list.bind(companyController))
);
companyRouter.use('/:companySlug/surveys', surveyRouter);
companyRouter.use('/:companySlug/users', companyUserRouter);
companyRouter.get(
  '/by-slug/:slug',
  requireAuth,
  requireRole([Role.ADMIN, Role.CLIENT_ADMIN]),
  asyncHandler(companyController.getBySlug.bind(companyController))
);
companyRouter.put(
  '/by-slug/:slug',
  requireAuth,
  requireAdmin,
  asyncHandler(companyController.updateBySlug.bind(companyController))
);
companyRouter.get(
  '/:id',
  requireAuth,
  requireRole([Role.ADMIN, Role.CLIENT_ADMIN]),
  requireCompanyAccess,
  asyncHandler(companyController.getById.bind(companyController))
);
companyRouter.put(
  '/:id',
  requireAuth,
  requireAdmin,
  asyncHandler(companyController.update.bind(companyController))
);

export { companyRouter };
