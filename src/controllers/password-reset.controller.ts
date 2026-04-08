import type { Request, Response } from 'express';
import { passwordResetService } from '../lib/container';
import { successResponse } from '../utils/apiResponse';
import {
  validateConfirmPasswordReset,
  validatePasswordResetToken
} from '../validators/password-reset.validator';

export class PasswordResetController {
  async validate(req: Request, res: Response) {
    const input = validatePasswordResetToken(req.query);
    const result = await passwordResetService.validateToken(input.token);

    res.status(200).json(successResponse('Token de recuperación válido', result));
  }

  async confirm(req: Request, res: Response) {
    const input = validateConfirmPasswordReset(req.body);
    const result = await passwordResetService.confirmReset(input);

    res.status(200).json(successResponse('Contraseña actualizada correctamente', result));
  }
}

export const passwordResetController = new PasswordResetController();
