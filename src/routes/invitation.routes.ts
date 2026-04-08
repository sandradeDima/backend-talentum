import { Router } from 'express';
import { invitationController } from '../controllers/invitation.controller';
import { asyncHandler } from '../utils/asyncHandler';

const invitationRouter = Router();

invitationRouter.get(
  '/validate',
  asyncHandler(invitationController.validate.bind(invitationController))
);
invitationRouter.post(
  '/accept',
  asyncHandler(invitationController.accept.bind(invitationController))
);

export { invitationRouter };
