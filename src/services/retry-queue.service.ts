import { logger } from '../lib/logger';

type RetryTaskOptions<T> = {
  key: string;
  maxAttempts: number;
  initialDelayMs: number;
  backoffMultiplier?: number;
  run: () => Promise<T>;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
};

const inFlightTasks = new Map<string, Promise<unknown>>();

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class RetryQueueService {
  async execute<T>(options: RetryTaskOptions<T>): Promise<T> {
    const existing = inFlightTasks.get(options.key);
    if (existing) {
      return existing as Promise<T>;
    }

    const promise = this.runTask(options).finally(() => {
      inFlightTasks.delete(options.key);
    });

    inFlightTasks.set(options.key, promise);
    return promise;
  }

  private async runTask<T>(options: RetryTaskOptions<T>): Promise<T> {
    const maxAttempts = Math.max(1, options.maxAttempts);
    const backoffMultiplier = options.backoffMultiplier ?? 2;
    let delayMs = Math.max(50, options.initialDelayMs);

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await options.run();
      } catch (error) {
        const canRetryByPolicy = options.shouldRetry
          ? options.shouldRetry(error, attempt)
          : true;
        const canRetry = attempt < maxAttempts && canRetryByPolicy;

        logger.warn('retry_queue_attempt_failed', {
          key: options.key,
          attempt,
          maxAttempts,
          canRetry,
          error
        });

        if (!canRetry) {
          throw error;
        }

        await wait(delayMs);
        delayMs = Math.round(delayMs * backoffMultiplier);
      }
    }

    throw new Error('Retry queue reached an unreachable state');
  }
}

export const retryQueueService = new RetryQueueService();
