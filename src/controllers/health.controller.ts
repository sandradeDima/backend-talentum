import type { Request, Response, NextFunction } from 'express';
import { successResponse } from '../utils/apiResponse';
import { HealthRepository } from '../repositories/health.repository';
import { HealthService } from '../services/health.service';

const healthService = new HealthService(new HealthRepository());

export const healthController = (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = healthService.check();
    res.status(200).json(successResponse('Servicio disponible', data));
  } catch (error) {
    next(error);
  }
};
