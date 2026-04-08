import type { Request, Response } from 'express';
import { AppError } from '../errors/appError';
import { supportConfigService } from '../lib/container';
import { successResponse } from '../utils/apiResponse';
import { buildAuditContext } from '../utils/request-context';
import {
  validatePublicSupportConfigParams,
  validateSupportConfigQuery,
  validateUpsertSupportConfig
} from '../validators/support-config.validator';

export class SupportConfigController {
  private getPrincipal(req: Request) {
    if (!req.authSession) {
      throw new AppError('No autenticado', 401, 'SESSION_NOT_FOUND');
    }

    return req.authSession.user;
  }

  async get(req: Request, res: Response) {
    const principal = this.getPrincipal(req);
    const query = validateSupportConfigQuery(req.query);
    const result = await supportConfigService.getSupportConfig(query, principal);

    res.status(200).json(successResponse('Configuración de soporte obtenida', result));
  }

  async upsert(req: Request, res: Response) {
    const principal = this.getPrincipal(req);
    const input = validateUpsertSupportConfig(req.body);
    const result = await supportConfigService.upsertSupportConfig(
      input,
      principal,
      buildAuditContext(req)
    );

    res.status(200).json(successResponse('Configuración de soporte actualizada', result));
  }

  async getPublic(req: Request, res: Response) {
    const params = validatePublicSupportConfigParams(req.params);
    const result = await supportConfigService.getPublicSupportConfig(params.companySlug);

    res.status(200).json(successResponse('Canales de soporte obtenidos', result));
  }
}

export const supportConfigController = new SupportConfigController();
