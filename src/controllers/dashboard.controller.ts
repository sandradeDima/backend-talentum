import type { Request, Response } from 'express';
import { AppError } from '../errors/appError';
import { dashboardService } from '../lib/container';
import { successResponse } from '../utils/apiResponse';
import {
  validateCreateDashboardExportJob,
  validateDashboardExportJobParams,
  validateListDashboardExportJobsQuery,
  validateDashboardProgressQuery,
  validateDashboardResultsQuery,
  validateRunDashboardExportWorker
} from '../validators/dashboard.validator';

export class DashboardController {
  private getPrincipal(req: Request) {
    if (!req.authSession) {
      throw new AppError('No autenticado', 401, 'SESSION_NOT_FOUND');
    }

    return req.authSession.user;
  }

  async getProgress(req: Request, res: Response) {
    const principal = this.getPrincipal(req);
    const query = validateDashboardProgressQuery(req.query);
    const result = await dashboardService.getDashboardProgress(query, principal);
    res.status(200).json(successResponse('Progreso de dashboard obtenido', result));
  }

  async getResults(req: Request, res: Response) {
    const principal = this.getPrincipal(req);
    const query = validateDashboardResultsQuery(req.query);
    const result = await dashboardService.getDashboardResults(query, principal);
    res.status(200).json(successResponse('Resultados de dashboard obtenidos', result));
  }

  async createExportJob(req: Request, res: Response) {
    const principal = this.getPrincipal(req);
    const input = validateCreateDashboardExportJob(req.body);
    const result = await dashboardService.createDashboardExportJob(input, principal);
    res.status(202).json(successResponse('Job de exportación creado', result));
  }

  async listExportJobs(req: Request, res: Response) {
    const principal = this.getPrincipal(req);
    const query = validateListDashboardExportJobsQuery(req.query);
    const result = await dashboardService.listDashboardExportJobs(query, principal);
    res.status(200).json(successResponse('Historial de exportaciones obtenido', result));
  }

  async getExportJob(req: Request, res: Response) {
    const principal = this.getPrincipal(req);
    const params = validateDashboardExportJobParams(req.params);
    const result = await dashboardService.getDashboardExportJob(params.jobId, principal);
    res.status(200).json(successResponse('Estado de exportación obtenido', result));
  }

  async downloadExportJob(req: Request, res: Response) {
    const principal = this.getPrincipal(req);
    const params = validateDashboardExportJobParams(req.params);
    const file = await dashboardService.getDashboardExportDownload(params.jobId, principal);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.download(file.filePath, file.fileName);
  }

  async runDueExports(req: Request, res: Response) {
    const input = validateRunDashboardExportWorker(req.body);
    const result = await dashboardService.processDueExportJobs({
      limit: input.limit
    });
    res.status(200).json(successResponse('Worker de exportación ejecutado', result));
  }
}

export const dashboardController = new DashboardController();
