import { Router } from 'express';
import { surveyResponseController } from '../controllers/survey-response.controller';
import { attachOptionalAuthSession } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const surveyResponseRouter = Router();

surveyResponseRouter.use(attachOptionalAuthSession);

surveyResponseRouter.post(
  '/start',
  asyncHandler(surveyResponseController.start.bind(surveyResponseController))
);
surveyResponseRouter.post(
  '/autosave',
  asyncHandler(surveyResponseController.autosave.bind(surveyResponseController))
);
surveyResponseRouter.post(
  '/submit',
  asyncHandler(surveyResponseController.submit.bind(surveyResponseController))
);

export { surveyResponseRouter };
