import { env } from '../config/env';
import { surveyOperationsService } from '../lib/container';
import { logger } from '../lib/logger';
import { monitoringService } from '../services/monitoring.service';
import { retryQueueService } from '../services/retry-queue.service';

type ReminderWorkerHandle = {
  stop: () => void;
};

export const startReminderWorker = (): ReminderWorkerHandle => {
  if (!env.REMINDER_WORKER_ENABLED) {
    logger.info('reminder_worker_disabled');
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
        key: 'worker:reminder:tick',
        maxAttempts: env.WORKER_TICK_RETRY_ATTEMPTS,
        initialDelayMs: env.WORKER_TICK_RETRY_DELAY_MS,
        run: () =>
          surveyOperationsService.processDueReminderSchedules({
            limit: env.REMINDER_BATCH_SIZE
          })
      });
      monitoringService.recordWorkerRun({
        worker: 'reminder',
        status: 'success',
        durationMs: Date.now() - startedAt
      });
    } catch (error) {
      monitoringService.recordWorkerRun({
        worker: 'reminder',
        status: 'error',
        durationMs: Date.now() - startedAt
      });
      logger.error('reminder_worker_tick_failed', {
        error
      });
    } finally {
      running = false;
    }
  };

  void tick();

  const intervalId = setInterval(
    () => void tick(),
    env.REMINDER_WORKER_INTERVAL_SECONDS * 1000
  );

  return {
    stop: () => {
      clearInterval(intervalId);
      logger.info('reminder_worker_stopped');
    }
  };
};
