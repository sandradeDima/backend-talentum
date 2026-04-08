import type { Request, Response } from 'express';
import { surveyExecutionService } from '../lib/container';
import { successResponse } from '../utils/apiResponse';
import {
  validatePublicSurveyBrandingParams,
  validateSurveyAccess
} from '../validators/survey-access.validator';

export class SurveyAccessController {
  async validate(req: Request, res: Response) {
    const input = validateSurveyAccess(req.body);
    const result = await surveyExecutionService.validateAccess(input);
    res.status(200).json(successResponse('Acceso de encuesta válido', result));
  }

  async getBranding(req: Request, res: Response) {
    const params = validatePublicSurveyBrandingParams(req.params);
    const result = await surveyExecutionService.getPublicEntryBranding(params.campaignSlug);
    res.status(200).json(successResponse('Branding público de encuesta obtenido', result));
  }
}

export const surveyAccessController = new SurveyAccessController();
