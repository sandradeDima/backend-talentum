import type { Request, Response } from 'express';
import { AppError } from '../errors/appError';
import { surveyService } from '../lib/container';
import { successResponse } from '../utils/apiResponse';
import {
  validateConfigureSurveyReminders,
  validateCreateSurveyCampaign,
  validateScheduleSurveySend,
  validateUpdateSurveyCampaign
} from '../validators/survey.validator';

export class SurveyController {
  private getCompanySlug(req: Request): string {
    const rawCompanySlug = req.params.companySlug;
    const companySlug = Array.isArray(rawCompanySlug) ? rawCompanySlug[0] : rawCompanySlug;

    if (!companySlug) {
      throw new AppError('Parámetro de empresa inválido', 400, 'INVALID_COMPANY_SLUG_PARAM');
    }

    return companySlug;
  }

  private getSurveySlug(req: Request): string {
    const rawSurveySlug = req.params.surveySlug;
    const surveySlug = Array.isArray(rawSurveySlug) ? rawSurveySlug[0] : rawSurveySlug;

    if (!surveySlug) {
      throw new AppError('Parámetro de encuesta inválido', 400, 'INVALID_SURVEY_SLUG_PARAM');
    }

    return surveySlug;
  }

  async list(req: Request, res: Response) {
    if (!req.authSession) {
      throw new AppError('No autenticado', 401, 'SESSION_NOT_FOUND');
    }

    const companySlug = this.getCompanySlug(req);
    const result = await surveyService.listByCompanySlug(companySlug, req.authSession.user);
    res.status(200).json(successResponse('Encuestas obtenidas', result));
  }

  async create(req: Request, res: Response) {
    if (!req.authSession) {
      throw new AppError('No autenticado', 401, 'SESSION_NOT_FOUND');
    }

    const input = validateCreateSurveyCampaign(req.body);
    const companySlug = this.getCompanySlug(req);
    const result = await surveyService.createSurveyCampaign(
      companySlug,
      input,
      req.authSession.user
    );

    res.status(201).json(successResponse('Encuesta creada en borrador', result));
  }

  async getBySlug(req: Request, res: Response) {
    if (!req.authSession) {
      throw new AppError('No autenticado', 401, 'SESSION_NOT_FOUND');
    }

    const companySlug = this.getCompanySlug(req);
    const surveySlug = this.getSurveySlug(req);
    const result = await surveyService.getSurveyCampaign(
      companySlug,
      surveySlug,
      req.authSession.user
    );

    res.status(200).json(successResponse('Encuesta obtenida', result));
  }

  async update(req: Request, res: Response) {
    if (!req.authSession) {
      throw new AppError('No autenticado', 401, 'SESSION_NOT_FOUND');
    }

    const input = validateUpdateSurveyCampaign(req.body);
    const companySlug = this.getCompanySlug(req);
    const surveySlug = this.getSurveySlug(req);
    const result = await surveyService.updateSurveyCampaign(
      companySlug,
      surveySlug,
      input,
      req.authSession.user
    );

    res.status(200).json(successResponse('Encuesta actualizada', result));
  }

  async scheduleInitialSend(req: Request, res: Response) {
    if (!req.authSession) {
      throw new AppError('No autenticado', 401, 'SESSION_NOT_FOUND');
    }

    const input = validateScheduleSurveySend(req.body);
    const companySlug = this.getCompanySlug(req);
    const surveySlug = this.getSurveySlug(req);
    const result = await surveyService.scheduleInitialSend(
      companySlug,
      surveySlug,
      input,
      req.authSession.user
    );

    res.status(200).json(successResponse('Envío inicial programado', result));
  }

  async configureReminders(req: Request, res: Response) {
    if (!req.authSession) {
      throw new AppError('No autenticado', 401, 'SESSION_NOT_FOUND');
    }

    const input = validateConfigureSurveyReminders(req.body);
    const companySlug = this.getCompanySlug(req);
    const surveySlug = this.getSurveySlug(req);
    const result = await surveyService.configureReminders(
      companySlug,
      surveySlug,
      input,
      req.authSession.user
    );

    res.status(200).json(successResponse('Recordatorios programados y confirmados', result));
  }

  async closeCampaign(req: Request, res: Response) {
    if (!req.authSession) {
      throw new AppError('No autenticado', 401, 'SESSION_NOT_FOUND');
    }

    const companySlug = this.getCompanySlug(req);
    const surveySlug = this.getSurveySlug(req);
    const result = await surveyService.closeSurveyCampaign(
      companySlug,
      surveySlug,
      req.authSession.user
    );

    res.status(200).json(successResponse('Encuesta cerrada', result));
  }

  async finalizeCampaign(req: Request, res: Response) {
    if (!req.authSession) {
      throw new AppError('No autenticado', 401, 'SESSION_NOT_FOUND');
    }

    const companySlug = this.getCompanySlug(req);
    const surveySlug = this.getSurveySlug(req);
    const result = await surveyService.finalizeSurveyCampaign(
      companySlug,
      surveySlug,
      req.authSession.user
    );

    res.status(200).json(successResponse('Encuesta finalizada', result));
  }
}

export const surveyController = new SurveyController();
