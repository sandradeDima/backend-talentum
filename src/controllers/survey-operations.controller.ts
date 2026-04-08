import type { Request, Response } from 'express';
import { AppError } from '../errors/appError';
import { surveyOperationsService } from '../lib/container';
import { successResponse } from '../utils/apiResponse';
import {
  validateCreateReminderSchedules,
  validateGenerateRespondentCredentials,
  validateImportSurveyRespondents,
  validateRunReminderWorkerNow
} from '../validators/survey-operations.validator';

export class SurveyOperationsController {
  private getCompanySlug(req: Request): string {
    const value = req.params.companySlug;
    const slug = Array.isArray(value) ? value[0] : value;

    if (!slug) {
      throw new AppError('Parámetro de empresa inválido', 400, 'INVALID_COMPANY_SLUG_PARAM');
    }

    return slug;
  }

  private getSurveySlug(req: Request): string {
    const value = req.params.surveySlug;
    const slug = Array.isArray(value) ? value[0] : value;

    if (!slug) {
      throw new AppError('Parámetro de encuesta inválido', 400, 'INVALID_SURVEY_SLUG_PARAM');
    }

    return slug;
  }

  async importRespondents(req: Request, res: Response) {
    if (!req.authSession) {
      throw new AppError('No autenticado', 401, 'SESSION_NOT_FOUND');
    }

    const input = validateImportSurveyRespondents(req.body);
    const companySlug = this.getCompanySlug(req);
    const surveySlug = this.getSurveySlug(req);

    const result = await surveyOperationsService.importRespondents(
      companySlug,
      surveySlug,
      input,
      req.authSession.user
    );

    res.status(200).json(successResponse('Importación procesada', result));
  }

  async getOperationsSummary(req: Request, res: Response) {
    if (!req.authSession) {
      throw new AppError('No autenticado', 401, 'SESSION_NOT_FOUND');
    }

    const companySlug = this.getCompanySlug(req);
    const surveySlug = this.getSurveySlug(req);

    const result = await surveyOperationsService.getOperationsSummary(
      companySlug,
      surveySlug,
      req.authSession.user
    );

    res.status(200).json(successResponse('Resumen operativo obtenido', result));
  }

  async generateCredentials(req: Request, res: Response) {
    if (!req.authSession) {
      throw new AppError('No autenticado', 401, 'SESSION_NOT_FOUND');
    }

    const input = validateGenerateRespondentCredentials(req.body);
    const companySlug = this.getCompanySlug(req);
    const surveySlug = this.getSurveySlug(req);

    const result = await surveyOperationsService.generateCredentials(
      companySlug,
      surveySlug,
      input,
      req.authSession.user
    );

    res.status(200).json(successResponse('Credenciales generadas', result));
  }

  async createReminderSchedules(req: Request, res: Response) {
    if (!req.authSession) {
      throw new AppError('No autenticado', 401, 'SESSION_NOT_FOUND');
    }

    const input = validateCreateReminderSchedules(req.body);
    const companySlug = this.getCompanySlug(req);
    const surveySlug = this.getSurveySlug(req);

    const result = await surveyOperationsService.createReminderSchedules(
      companySlug,
      surveySlug,
      input,
      req.authSession.user
    );

    res.status(201).json(successResponse('Recordatorios programados', result));
  }

  async sendInvitationsNow(req: Request, res: Response) {
    if (!req.authSession) {
      throw new AppError('No autenticado', 401, 'SESSION_NOT_FOUND');
    }

    const companySlug = this.getCompanySlug(req);
    const surveySlug = this.getSurveySlug(req);

    const result = await surveyOperationsService.sendInvitationsNow(
      companySlug,
      surveySlug,
      req.authSession.user
    );

    res.status(200).json(successResponse('Invitaciones enviadas', result));
  }

  async runReminderWorker(req: Request, res: Response) {
    const input = validateRunReminderWorkerNow(req.body);
    const result = await surveyOperationsService.processDueReminderSchedules({
      limit: input.limit
    });

    res.status(200).json(successResponse('Worker de recordatorios ejecutado', result));
  }

  async listRespondents(req: Request, res: Response) {
    if (!req.authSession) {
      throw new AppError('No autenticado', 401, 'SESSION_NOT_FOUND');
    }

    const companySlug = this.getCompanySlug(req);
    const surveySlug = this.getSurveySlug(req);

    const result = await surveyOperationsService.listRespondents(
      companySlug,
      surveySlug,
      req.authSession.user
    );

    res.status(200).json(successResponse('Participantes obtenidos', result));
  }
}

export const surveyOperationsController = new SurveyOperationsController();
