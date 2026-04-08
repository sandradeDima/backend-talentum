import type { Request, Response } from 'express';
import { invitationService } from '../lib/container';
import { successResponse } from '../utils/apiResponse';
import { appendSetCookies } from '../utils/cookies';
import {
  validateAcceptInvitation,
  validateInvitationToken
} from '../validators/invitation.validator';

export class InvitationController {
  async validate(req: Request, res: Response) {
    const input = validateInvitationToken(req.query);
    const result = await invitationService.validateInvitationToken(input.token);

    res.status(200).json(successResponse('Invitación válida', result));
  }

  async accept(req: Request, res: Response) {
    const input = validateAcceptInvitation(req.body);
    const result = await invitationService.acceptInvitation(input, req.headers);
    const statusCode = typeof result.status === 'number' ? result.status : 200;

    appendSetCookies(res, result.cookies);

    res
      .status(statusCode)
      .json(successResponse('Invitación aceptada y cuenta creada', result.response));
  }
}

export const invitationController = new InvitationController();
