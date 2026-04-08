import { env } from '../config/env';
import { dashboardService } from '../lib/container';
import { logger } from '../lib/logger';
import { monitoringService } from '../services/monitoring.service';
import { retryQueueService } from '../services/retry-queue.service';

type DashboardExportWorkerHandle = {
  stop: () => void;
};

export const startDashboardExportWorker = (): DashboardExportWorkerHandle => {
  if (!env.DASHBOARD_EXPORT_WORKER_ENABLED) {
    logger.info('dashboard_export_worker_disabled');
    return {
      stop: () => {}
    };
  }

  let running = false;

  const tick = async () => {
    if (running) {
      return;
    }

    running = true;
    const startedAt = Date.now();

    try {
      await retryQueueService.execute({
        key: 'worker:dashboard_export:tick',
        maxAttempts: env.WORKER_TICK_RETRY_ATTEMPTS,
        initialDelayMs: env.WORKER_TICK_RETRY_DELAY_MS,
        run: () =>
          dashboardService.processDueExportJobs({
            limit: env.DASHBOARD_EXPORT_BATCH_SIZE
          })
      });
      monitoringService.recordWorkerRun({
        worker: 'dashboard_export',
        status: 'success',
        durationMs: Date.now() - startedAt
      });
    } catch (error) {
      monitoringService.recordWorkerRun({
        worker: 'dashboard_export',
        status: 'error',
        durationMs: Date.now() - startedAt
      });
      logger.error('dashboard_export_worker_tick_failed', {
        error
      });
    } finally {
      running = false;
    }
  };

  void tick();

  const intervalId = setInterval(
    () => void tick(),
    env.DASHBOARD_EXPORT_WORKER_INTERVAL_SECONDS * 1000
  );

  return {
    stop: () => {
      clearInterval(intervalId);
      logger.info('dashboard_export_worker_stopped');
    }
  };
};
