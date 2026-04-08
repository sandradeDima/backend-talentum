import type { Request, Response } from 'express';
import { AppError } from '../errors/appError';
import { coolturaConfigService } from '../lib/container';
import { successResponse } from '../utils/apiResponse';
import { validateUpsertCoolturaConfig } from '../validators/cooltura-config.validator';

export class CoolturaConfigController {
  private getPrincipal(req: Request) {
    if (!req.authSession) {
      throw new AppError('No autenticado', 401, 'SESSION_NOT_FOUND');
    }
    return req.authSession.user;
  }

  async get(req: Request, res: Response) {
    const principal = this.getPrincipal(req);
    const result = await coolturaConfigService.getConfig(principal);
    res.status(200).json(successResponse('Configuración obtenida', result));
  }

  async upsert(req: Request, res: Response) {
    const principal = this.getPrincipal(req);
    const input = validateUpsertCoolturaConfig(req.body);
    const result = await coolturaConfigService.upsertConfig(input, principal);
    res.status(200).json(successResponse('Configuración actualizada', result));
  }
}

export const coolturaConfigController = new CoolturaConfigController();
