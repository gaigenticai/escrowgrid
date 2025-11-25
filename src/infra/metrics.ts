type Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD' | string;

export interface RequestMetricsSnapshot {
  totalRequests: number;
  totalErrors: number;
  requestsByStatus: Record<number, number>;
  requestsByMethod: Record<string, number>;
  averageDurationMs: number;
}

let totalRequests = 0;
let totalErrors = 0;
const requestsByStatus: Record<number, number> = {};
const requestsByMethod: Record<string, number> = {};
let totalDurationMs = 0;

export function recordRequestMetric(method: Method, status: number, durationMs: number): void {
  totalRequests += 1;
  if (status >= 500) {
    totalErrors += 1;
  }
  requestsByStatus[status] = (requestsByStatus[status] ?? 0) + 1;
  const normalizedMethod = method.toUpperCase();
  requestsByMethod[normalizedMethod] = (requestsByMethod[normalizedMethod] ?? 0) + 1;
  totalDurationMs += durationMs;
}

export function getRequestMetricsSnapshot(): RequestMetricsSnapshot {
  const averageDurationMs = totalRequests > 0 ? totalDurationMs / totalRequests : 0;
  return {
    totalRequests,
    totalErrors,
    requestsByStatus: { ...requestsByStatus },
    requestsByMethod: { ...requestsByMethod },
    averageDurationMs,
  };
}

