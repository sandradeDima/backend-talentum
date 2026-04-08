import type { Request, Response } from 'express';
import { surveyExecutionService } from '../lib/container';
import { successResponse } from '../utils/apiResponse';
import {
  validateAutosaveSurveyResponse,
  validateStartSurveyResponse,
  validateSubmitSurveyResponse
} from '../validators/survey-response.validator';

export class SurveyResponseController {
  async start(req: Request, res: Response) {
    const input = validateStartSurveyResponse(req.body);
    const result = await surveyExecutionService.startSurveyResponse(input);
    res.status(200).json(successResponse('Encuesta iniciada', result));
  }

  async autosave(req: Request, res: Response) {
    const input = validateAutosaveSurveyResponse(req.body);
    const result = await surveyExecutionService.autosaveSurveyResponse(input);
    res.status(200).json(successResponse('Respuestas guardadas', result));
  }

  async submit(req: Request, res: Response) {
    const input = validateSubmitSurveyResponse(req.body);
    const result = await surveyExecutionService.submitSurveyResponse(input);
    res.status(200).json(successResponse('Encuesta enviada', result));
  }
}

export const surveyResponseController = new SurveyResponseController();
