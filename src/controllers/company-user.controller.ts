import type { Request, Response } from 'express';
import { AppError } from '../errors/appError';
import { companyUserService } from '../lib/container';
import { successResponse } from '../utils/apiResponse';
import {
  validateCreateCompanyUser,
  validateUpdateCompanyUser
} from '../validators/company-user.validator';

export class CompanyUserController {
  private getCompanySlug(req: Request): string {
    const rawCompanySlug = req.params.companySlug;
    const companySlug = Array.isArray(rawCompanySlug) ? rawCompanySlug[0] : rawCompanySlug;

    if (!companySlug) {
      throw new AppError('Parámetro de empresa inválido', 400, 'INVALID_COMPANY_SLUG_PARAM');
    }

    return companySlug;
  }

  private getUserId(req: Request): string {
    const rawUserId = req.params.userId;
    const userId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;

    if (!userId) {
      throw new AppError('Parámetro de usuario inválido', 400, 'INVALID_USER_ID_PARAM');
    }

    return userId;
  }

  async list(req: Request, res: Response) {
    if (!req.authSession) {
      throw new AppError('No autenticado', 401, 'SESSION_NOT_FOUND');
    }

    const companySlug = this.getCompanySlug(req);
    const result = await companyUserService.listByCompanySlug(companySlug, req.authSession.user);

    res.status(200).json(successResponse('Usuarios obtenidos', result));
  }

  async create(req: Request, res: Response) {
    if (!req.authSession) {
      throw new AppError('No autenticado', 401, 'SESSION_NOT_FOUND');
    }

    const companySlug = this.getCompanySlug(req);
    const input = validateCreateCompanyUser(req.body);
    const result = await companyUserService.createCompanyUser(companySlug, input, req.authSession.user);

    res.status(201).json(successResponse('Usuario creado e invitación enviada', result));
  }

  async update(req: Request, res: Response) {
    if (!req.authSession) {
      throw new AppError('No autenticado', 401, 'SESSION_NOT_FOUND');
    }

    const companySlug = this.getCompanySlug(req);
    const userId = this.getUserId(req);
    const input = validateUpdateCompanyUser(req.body);
    const result = await companyUserService.updateCompanyUser(
      companySlug,
      userId,
      input,
      req.authSession.user
    );

    res.status(200).json(successResponse('Usuario actualizado', result));
  }

  async deactivate(req: Request, res: Response) {
    if (!req.authSession) {
      throw new AppError('No autenticado', 401, 'SESSION_NOT_FOUND');
    }

    const companySlug = this.getCompanySlug(req);
    const userId = this.getUserId(req);
    const result = await companyUserService.deactivateCompanyUser(
      companySlug,
      userId,
      req.authSession.user
    );

    res.status(200).json(successResponse('Usuario desactivado', result));
  }

  async resetPassword(req: Request, res: Response) {
    if (!req.authSession) {
      throw new AppError('No autenticado', 401, 'SESSION_NOT_FOUND');
    }

    const companySlug = this.getCompanySlug(req);
    const userId = this.getUserId(req);
    const result = await companyUserService.resetPassword(
      companySlug,
      userId,
      req.authSession.user
    );

    res.status(200).json(successResponse('Correo de reseteo enviado', result));
  }

  async resendInvite(req: Request, res: Response) {
    if (!req.authSession) {
      throw new AppError('No autenticado', 401, 'SESSION_NOT_FOUND');
    }

    const companySlug = this.getCompanySlug(req);
    const userId = this.getUserId(req);
    const result = await companyUserService.resendInvitation(
      companySlug,
      userId,
      req.authSession.user
    );

    res.status(200).json(successResponse('Invitación reenviada', result));
  }
}

export const companyUserController = new CompanyUserController();
