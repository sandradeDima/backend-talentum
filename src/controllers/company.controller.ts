import type { Request, Response } from 'express';
import { AppError } from '../errors/appError';
import { companyService } from '../lib/container';
import { successResponse } from '../utils/apiResponse';
import {
  validateCreateCompany,
  validateListCompaniesQuery,
  validateSuggestCompanySlug,
  validateUpdateCompany
} from '../validators/company.validator';

export class CompanyController {
  private getCompanyIdFromParams(req: Request): string {
    const rawCompanyId = req.params.id;
    const companyId = Array.isArray(rawCompanyId) ? rawCompanyId[0] : rawCompanyId;

    if (!companyId) {
      throw new AppError('Parámetro de empresa inválido', 400, 'INVALID_COMPANY_ID_PARAM');
    }

    return companyId;
  }

  private getCompanySlugFromParams(req: Request): string {
    const rawCompanySlug = req.params.slug;
    const companySlug = Array.isArray(rawCompanySlug) ? rawCompanySlug[0] : rawCompanySlug;

    if (!companySlug) {
      throw new AppError('Parámetro de slug inválido', 400, 'INVALID_COMPANY_SLUG_PARAM');
    }

    return companySlug;
  }

  async create(req: Request, res: Response) {
    if (!req.authSession) {
      throw new AppError('No autenticado', 401, 'SESSION_NOT_FOUND');
    }

    const input = validateCreateCompany(req.body);
    const result = await companyService.createCompany(input, req.authSession.user.id);

    res.status(201).json(successResponse('Empresa creada', result));
  }

  async list(req: Request, res: Response) {
    if (!req.authSession) {
      throw new AppError('No autenticado', 401, 'SESSION_NOT_FOUND');
    }

    const query = validateListCompaniesQuery(req.query);
    const result = await companyService.listCompanies(req.authSession.user, query);
    res.status(200).json(successResponse('Empresas obtenidas', result));
  }

  async getById(req: Request, res: Response) {
    if (!req.authSession) {
      throw new AppError('No autenticado', 401, 'SESSION_NOT_FOUND');
    }

    const companyId = this.getCompanyIdFromParams(req);
    const result = await companyService.getCompanyById(companyId, req.authSession.user);
    res.status(200).json(successResponse('Empresa obtenida', result));
  }

  async getBySlug(req: Request, res: Response) {
    if (!req.authSession) {
      throw new AppError('No autenticado', 401, 'SESSION_NOT_FOUND');
    }

    const slug = this.getCompanySlugFromParams(req);
    const result = await companyService.getCompanyBySlug(slug, req.authSession.user);
    res.status(200).json(successResponse('Empresa obtenida', result));
  }

  async suggestSlug(req: Request, res: Response) {
    if (!req.authSession) {
      throw new AppError('No autenticado', 401, 'SESSION_NOT_FOUND');
    }

    const input = validateSuggestCompanySlug(req.query);
    const result = await companyService.suggestSlugs(input, req.authSession.user);
    res.status(200).json(successResponse('Sugerencias de slug generadas', result));
  }

  async update(req: Request, res: Response) {
    if (!req.authSession) {
      throw new AppError('No autenticado', 401, 'SESSION_NOT_FOUND');
    }

    const input = validateUpdateCompany(req.body);
    const companyId = this.getCompanyIdFromParams(req);
    const result = await companyService.updateCompany(companyId, input, req.authSession.user);

    res.status(200).json(successResponse('Empresa actualizada', result));
  }

  async updateBySlug(req: Request, res: Response) {
    if (!req.authSession) {
      throw new AppError('No autenticado', 401, 'SESSION_NOT_FOUND');
    }

    const input = validateUpdateCompany(req.body);
    const slug = this.getCompanySlugFromParams(req);
    const result = await companyService.updateCompanyBySlug(slug, input, req.authSession.user);

    res.status(200).json(successResponse('Empresa actualizada', result));
  }
}

export const companyController = new CompanyController();
