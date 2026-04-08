import {
  createDashboardExportJobDtoSchema,
  dashboardExportJobParamsDtoSchema,
  listDashboardExportJobsQueryDtoSchema,
  dashboardProgressQueryDtoSchema,
  dashboardResultsQueryDtoSchema,
  runDashboardExportWorkerDtoSchema,
  type CreateDashboardExportJobDto,
  type DashboardExportJobParamsDto,
  type ListDashboardExportJobsQueryDto,
  type DashboardProgressQueryDto,
  type DashboardResultsQueryDto,
  type RunDashboardExportWorkerDto
} from '../dto/dashboard.dto';

export const validateDashboardProgressQuery = (
  input: unknown
): DashboardProgressQueryDto => {
  return dashboardProgressQueryDtoSchema.parse(input);
};

export const validateDashboardResultsQuery = (
  input: unknown
): DashboardResultsQueryDto => {
  return dashboardResultsQueryDtoSchema.parse(input);
};

export const validateCreateDashboardExportJob = (
  input: unknown
): CreateDashboardExportJobDto => {
  return createDashboardExportJobDtoSchema.parse(input);
};

export const validateListDashboardExportJobsQuery = (
  input: unknown
): ListDashboardExportJobsQueryDto => {
  return listDashboardExportJobsQueryDtoSchema.parse(input);
};

export const validateDashboardExportJobParams = (
  input: unknown
): DashboardExportJobParamsDto => {
  return dashboardExportJobParamsDtoSchema.parse(input);
};

export const validateRunDashboardExportWorker = (
  input: unknown
): RunDashboardExportWorkerDto => {
  return runDashboardExportWorkerDtoSchema.parse(input);
};
