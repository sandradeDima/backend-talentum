import { Router } from 'express';
import { adminRouter } from './admin.routes';
import { authRouter } from './auth.routes';
import { companyRouter } from './company.routes';
import { dashboardRouter } from './dashboard.routes';
import { healthRouter } from './health.routes';
import { invitationRouter } from './invitation.routes';
import { passwordResetRouter } from './password-reset.routes';
import { resourceLibraryRouter } from './resource-library.routes';
import { coolturaConfigRouter } from './cooltura-config.routes';
import { supportConfigRouter } from './support-config.routes';
import { surveyAccessRouter } from './survey-access.routes';
import { surveyResponseRouter } from './survey-response.routes';
import { uploadRouter } from './upload.routes';

const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/admin', adminRouter);
apiRouter.use('/dashboard', dashboardRouter);
apiRouter.use('/invitations', invitationRouter);
apiRouter.use('/password-reset', passwordResetRouter);
apiRouter.use('/resource-library', resourceLibraryRouter);
apiRouter.use('/support-config', supportConfigRouter);
apiRouter.use('/cooltura-config', coolturaConfigRouter);
apiRouter.use('/survey-access', surveyAccessRouter);
apiRouter.use('/survey-response', surveyResponseRouter);
apiRouter.use('/companies', companyRouter);
apiRouter.use('/uploads', uploadRouter);

export { apiRouter };
