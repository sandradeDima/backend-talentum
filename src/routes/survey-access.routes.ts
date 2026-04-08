import { Router } from 'express';
import { surveyAccessController } from '../controllers/survey-access.controller';
import { attachOptionalAuthSession } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const surveyAccessRouter = Router();

surveyAccessRouter.use(attachOptionalAuthSession);

surveyAccessRouter.get(
  '/branding/:campaignSlug',
  asyncHandler(surveyAccessController.getBranding.bind(surveyAccessController))
);

surveyAccessRouter.post(
  '/validate',
  asyncHandler(surveyAccessController.validate.bind(surveyAccessController))
);

export { surveyAccessRouter };
