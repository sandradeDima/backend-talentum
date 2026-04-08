import { DashboardGroupBy } from '@prisma/client';
import { z } from 'zod';

export const dashboardProgressQueryDtoSchema = z.object({
  surveySlug: z.string().trim().min(2).max(160),
  groupBy: z.nativeEnum(DashboardGroupBy).default(DashboardGroupBy.COMPANY)
});

export const dashboardResultsQueryDtoSchema = z.object({
  surveySlug: z.string().trim().min(2).max(160),
  groupBy: z.nativeEnum(DashboardGroupBy).default(DashboardGroupBy.COMPANY)
});

export const createDashboardExportJobDtoSchema = z.object({
  surveySlug: z.string().trim().min(2).max(160),
  groupBy: z.nativeEnum(DashboardGroupBy).default(DashboardGroupBy.COMPANY)
});

export const listDashboardExportJobsQueryDtoSchema = z.object({
  surveySlug: z.string().trim().min(2).max(160),
  groupBy: z.nativeEnum(DashboardGroupBy).default(DashboardGroupBy.COMPANY),
  limit: z.coerce.number().int().min(1).max(20).default(10)
});

export const dashboardExportJobParamsDtoSchema = z.object({
  jobId: z.string().trim().min(2).max(120)
});

export const runDashboardExportWorkerDtoSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(5)
});

export type DashboardProgressQueryDto = z.infer<typeof dashboardProgressQueryDtoSchema>;
export type DashboardResultsQueryDto = z.infer<typeof dashboardResultsQueryDtoSchema>;
export type CreateDashboardExportJobDto = z.infer<typeof createDashboardExportJobDtoSchema>;
export type ListDashboardExportJobsQueryDto = z.infer<typeof listDashboardExportJobsQueryDtoSchema>;
export type DashboardExportJobParamsDto = z.infer<typeof dashboardExportJobParamsDtoSchema>;
export type RunDashboardExportWorkerDto = z.infer<typeof runDashboardExportWorkerDtoSchema>;
