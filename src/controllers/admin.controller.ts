import type { Request, Response } from 'express';
import { AppError } from '../errors/appError';
import { companyUserService, surveyOperationsService, surveyService } from '../lib/container';
import { successResponse } from '../utils/apiResponse';
import { validateListGlobalCompanyUsersQuery } from '../validators/company-user.validator';
import { validateRunReminderWorkerNow } from '../validators/survey-operations.validator';
import { validateListGlobalSurveyCampaignsQuery } from '../validators/survey.validator';

export class AdminController {
  async listUsers(req: Request, res: Response) {
    if (!req.authSession) {
      throw new AppError('No autenticado', 401, 'SESSION_NOT_FOUND');
    }

    const query = validateListGlobalCompanyUsersQuery(req.query);
    const result = await companyUserService.listGlobalUsers(query, req.authSession.user);

    res.status(200).json(successResponse('Usuarios globales obtenidos', result));
  }

  async listSurveys(req: Request, res: Response) {
    if (!req.authSession) {
      throw new AppError('No autenticado', 401, 'SESSION_NOT_FOUND');
    }

    const query = validateListGlobalSurveyCampaignsQuery(req.query);
    const result = await surveyService.listGlobalSurveys(query, req.authSession.user);

    res.status(200).json(successResponse('Encuestas globales obtenidas', result));
  }

  async runDueReminders(req: Request, res: Response) {
    const input = validateRunReminderWorkerNow(req.body);
    const result = await surveyOperationsService.processDueReminderSchedules({
      limit: input.limit
    });

    res.status(200).json(successResponse('Recordatorios procesados', result));
  }
}

export const adminController = new AdminController();
