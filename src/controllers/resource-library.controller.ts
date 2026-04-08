import type { Request, Response } from 'express';
import { AppError } from '../errors/appError';
import { resourceLibraryService } from '../lib/container';
import { successResponse } from '../utils/apiResponse';
import { buildAuditContext } from '../utils/request-context';
import {
  validateCreateResourceLibraryItem,
  validateListResourceLibraryQuery,
  validateResourceLibraryItemParams,
  validateUpdateResourceLibraryItem
} from '../validators/resource-library.validator';

export class ResourceLibraryController {
  private getPrincipal(req: Request) {
    if (!req.authSession) {
      throw new AppError('No autenticado', 401, 'SESSION_NOT_FOUND');
    }

    return req.authSession.user;
  }

  async list(req: Request, res: Response) {
    const principal = this.getPrincipal(req);
    const query = validateListResourceLibraryQuery(req.query);
    const result = await resourceLibraryService.listResources(query, principal);

    res.status(200).json(successResponse('Recursos obtenidos', result));
  }

  async getById(req: Request, res: Response) {
    const principal = this.getPrincipal(req);
    const params = validateResourceLibraryItemParams(req.params);
    const result = await resourceLibraryService.getResourceById(params.resourceId, principal);

    res.status(200).json(successResponse('Recurso obtenido', result));
  }

  async create(req: Request, res: Response) {
    const principal = this.getPrincipal(req);
    const input = validateCreateResourceLibraryItem(req.body);
    const result = await resourceLibraryService.createResource(
      input,
      principal,
      buildAuditContext(req)
    );

    res.status(201).json(successResponse('Recurso creado', result));
  }

  async update(req: Request, res: Response) {
    const principal = this.getPrincipal(req);
    const params = validateResourceLibraryItemParams(req.params);
    const input = validateUpdateResourceLibraryItem(req.body);
    const result = await resourceLibraryService.updateResource(
      params.resourceId,
      input,
      principal,
      buildAuditContext(req)
    );

    res.status(200).json(successResponse('Recurso actualizado', result));
  }

  async deactivate(req: Request, res: Response) {
    const principal = this.getPrincipal(req);
    const params = validateResourceLibraryItemParams(req.params);
    const result = await resourceLibraryService.deactivateResource(
      params.resourceId,
      principal,
      buildAuditContext(req)
    );

    res.status(200).json(successResponse('Recurso desactivado', result));
  }

  async supportedTypes(_req: Request, res: Response) {
    const types = resourceLibraryService.getSupportedItemTypes();
    res.status(200).json(successResponse('Tipos de recurso disponibles', { types }));
  }
}

export const resourceLibraryController = new ResourceLibraryController();
