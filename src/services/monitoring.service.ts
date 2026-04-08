type RequestAggregate = {
  count: number;
  errorCount: number;
  totalDurationMs: number;
  maxDurationMs: number;
};

type WorkerAggregate = {
  successCount: number;
  errorCount: number;
  totalDurationMs: number;
  maxDurationMs: number;
  lastErrorAt: string | null;
};

const requestMetrics = new Map<string, RequestAggregate>();
const workerMetrics = new Map<string, WorkerAggregate>();

export class MonitoringService {
  recordRequest(input: {
    method: string;
    route: string;
    statusCode: number;
    durationMs: number;
  }) {
    const key = `${input.method.toUpperCase()} ${input.route}`;
    const current = requestMetrics.get(key) ?? {
      count: 0,
      errorCount: 0,
      totalDurationMs: 0,
      maxDurationMs: 0
    };

    current.count += 1;
    if (input.statusCode >= 500) {
      current.errorCount += 1;
    }
    current.totalDurationMs += input.durationMs;
    current.maxDurationMs = Math.max(current.maxDurationMs, input.durationMs);

    requestMetrics.set(key, current);
  }

  recordWorkerRun(input: {
    worker: string;
    status: 'success' | 'error';
    durationMs: number;
  }) {
    const current = workerMetrics.get(input.worker) ?? {
      successCount: 0,
      errorCount: 0,
      totalDurationMs: 0,
      maxDurationMs: 0,
      lastErrorAt: null
    };

    if (input.status === 'success') {
      current.successCount += 1;
    } else {
      current.errorCount += 1;
      current.lastErrorAt = new Date().toISOString();
    }

    current.totalDurationMs += input.durationMs;
    current.maxDurationMs = Math.max(current.maxDurationMs, input.durationMs);

    workerMetrics.set(input.worker, current);
  }

  snapshot() {
    const requests = Array.from(requestMetrics.entries()).map(([key, value]) => ({
      key,
      count: value.count,
      errorCount: value.errorCount,
      avgDurationMs: value.count > 0 ? Number((value.totalDurationMs / value.count).toFixed(2)) : 0,
      maxDurationMs: Number(value.maxDurationMs.toFixed(2))
    }));

    const workers = Array.from(workerMetrics.entries()).map(([worker, value]) => {
      const runs = value.successCount + value.errorCount;
      return {
        worker,
        successCount: value.successCount,
        errorCount: value.errorCount,
        avgDurationMs: runs > 0 ? Number((value.totalDurationMs / runs).toFixed(2)) : 0,
        maxDurationMs: Number(value.maxDurationMs.toFixed(2)),
        lastErrorAt: value.lastErrorAt
      };
    });

    return {
      generatedAt: new Date().toISOString(),
      requests,
      workers
    };
  }
}

export const monitoringService = new MonitoringService();
