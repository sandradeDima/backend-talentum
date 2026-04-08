import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { getAuthNodeHandler } from '../lib/auth';

const authRouter = Router();

const handleBetterAuthInternal = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const handler = await getAuthNodeHandler();
    await handler(req, res);
  } catch (error) {
    next(error);
  }
};

authRouter.all('/internal', handleBetterAuthInternal);
authRouter.all('/internal/*', handleBetterAuthInternal);
authRouter.get('/csrf', asyncHandler(authController.csrfToken.bind(authController)));
authRouter.post('/login', asyncHandler(authController.login.bind(authController)));
authRouter.get(
  '/social/:provider/start',
  asyncHandler(authController.startSocialSignIn.bind(authController))
);
authRouter.post(
  '/social/finalize',
  asyncHandler(authController.finalizeSocialSignIn.bind(authController))
);
authRouter.get(
  '/company-context/:slug',
  asyncHandler(authController.companyContext.bind(authController))
);
authRouter.post(
  '/logout',
  asyncHandler(authController.logout.bind(authController))
);
authRouter.get('/me', requireAuth, asyncHandler(authController.me.bind(authController)));

export { authRouter };
