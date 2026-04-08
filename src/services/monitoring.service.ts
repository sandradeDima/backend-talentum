type RequestAggregate = {
  count: number;
  errorCount: number;
  totalDurationMs: number;
  maxDurationMs: number;
};

type WorkerAggregate = {
  enabled: boolean;
  intervalSeconds: number;
  successCount: number;
  errorCount: number;
  totalDurationMs: number;
  maxDurationMs: number;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastStatus: 'success' | 'error' | null;
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
      enabled: true,
      intervalSeconds: 60,
      successCount: 0,
      errorCount: 0,
      totalDurationMs: 0,
      maxDurationMs: 0,
      lastRunAt: null,
      lastSuccessAt: null,
      lastErrorAt: null,
      lastStatus: null
    };
    const nowIso = new Date().toISOString();

    if (input.status === 'success') {
      current.successCount += 1;
      current.lastSuccessAt = nowIso;
    } else {
      current.errorCount += 1;
      current.lastErrorAt = nowIso;
    }

    current.totalDurationMs += input.durationMs;
    current.maxDurationMs = Math.max(current.maxDurationMs, input.durationMs);
    current.lastRunAt = nowIso;
    current.lastStatus = input.status;

    workerMetrics.set(input.worker, current);
  }

  registerWorker(input: {
    worker: string;
    enabled: boolean;
    intervalSeconds: number;
  }) {
    const current = workerMetrics.get(input.worker) ?? {
      enabled: input.enabled,
      intervalSeconds: input.intervalSeconds,
      successCount: 0,
      errorCount: 0,
      totalDurationMs: 0,
      maxDurationMs: 0,
      lastRunAt: null,
      lastSuccessAt: null,
      lastErrorAt: null,
      lastStatus: null
    };

    current.enabled = input.enabled;
    current.intervalSeconds = input.intervalSeconds;

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
        enabled: value.enabled,
        intervalSeconds: value.intervalSeconds,
        successCount: value.successCount,
        errorCount: value.errorCount,
        avgDurationMs: runs > 0 ? Number((value.totalDurationMs / runs).toFixed(2)) : 0,
        maxDurationMs: Number(value.maxDurationMs.toFixed(2)),
        lastRunAt: value.lastRunAt,
        lastSuccessAt: value.lastSuccessAt,
        lastErrorAt: value.lastErrorAt,
        lastStatus: value.lastStatus
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
