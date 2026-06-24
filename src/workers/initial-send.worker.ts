import { env } from '../config/env';
import { surveyOperationsService } from '../lib/container';
import { logger } from '../lib/logger';
import { monitoringService } from '../services/monitoring.service';
import { retryQueueService } from '../services/retry-queue.service';

type InitialSendWorkerHandle = {
  stop: () => void;
};

export const startInitialSendWorker = (): InitialSendWorkerHandle => {
  monitoringService.registerWorker({
    worker: 'initial_send',
    enabled: env.INITIAL_SEND_WORKER_ENABLED,
    intervalSeconds: env.INITIAL_SEND_WORKER_INTERVAL_SECONDS
  });

  if (!env.INITIAL_SEND_WORKER_ENABLED) {
    logger.info('initial_send_worker_disabled');
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
        key: 'worker:initial_send:tick',
        maxAttempts: env.WORKER_TICK_RETRY_ATTEMPTS,
        initialDelayMs: env.WORKER_TICK_RETRY_DELAY_MS,
        run: () =>
          surveyOperationsService.processDueInitialSendCampaigns({
            limit: env.INITIAL_SEND_BATCH_SIZE
          })
      });
      monitoringService.recordWorkerRun({
        worker: 'initial_send',
        status: 'success',
        durationMs: Date.now() - startedAt
      });
    } catch (error) {
      monitoringService.recordWorkerRun({
        worker: 'initial_send',
        status: 'error',
        durationMs: Date.now() - startedAt
      });
      logger.error('initial_send_worker_tick_failed', {
        error
      });
    } finally {
      running = false;
    }
  };

  void tick();

  const intervalId = setInterval(
    () => void tick(),
    env.INITIAL_SEND_WORKER_INTERVAL_SECONDS * 1000
  );

  return {
    stop: () => {
      clearInterval(intervalId);
      logger.info('initial_send_worker_stopped');
    }
  };
};
