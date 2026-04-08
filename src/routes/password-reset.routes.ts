import { Router } from 'express';
import { passwordResetController } from '../controllers/password-reset.controller';
import { asyncHandler } from '../utils/asyncHandler';

const passwordResetRouter = Router();

passwordResetRouter.get(
  '/validate',
  asyncHandler(passwordResetController.validate.bind(passwordResetController))
);
passwordResetRouter.post(
  '/confirm',
  asyncHandler(passwordResetController.confirm.bind(passwordResetController))
);

export { passwordResetRouter };
