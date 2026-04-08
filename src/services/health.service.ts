import { HealthRepository } from '../repositories/health.repository';
import { monitoringService } from './monitoring.service';

export class HealthService {
  constructor(private readonly healthRepository: HealthRepository) {}

  check() {
    const monitoring = monitoringService.snapshot();
    const now = Date.now();
    const workers = monitoring.workers.map((worker) => {
      const staleAfterMs = Math.max(30000, worker.intervalSeconds * 2000 + 5000);
      const lastRunAtMs = worker.lastRunAt ? new Date(worker.lastRunAt).getTime() : null;
      const isStale = lastRunAtMs !== null ? now - lastRunAtMs > staleAfterMs : false;
      const health =
        !worker.enabled
          ? 'disabled'
          : worker.lastRunAt === null
            ? 'starting'
            : isStale
              ? 'stale'
              : worker.lastStatus === 'error'
                ? 'degraded'
                : 'healthy';

      return {
        ...worker,
        staleAfterMs,
        health
      };
    });

    const hasWorkerIssue = workers.some(
      (worker) => worker.health === 'degraded' || worker.health === 'stale'
    );

    return {
      ...this.healthRepository.getStatus(),
      ...(hasWorkerIssue ? { status: 'degraded' } : {}),
      monitoring: {
        ...monitoring,
        workers
      }
    };
  }
}
