// Lightweight client-side timing + retry helpers for dashboard queries.
// We wrap the server-fn call so slow responses show up in the console
// (with a > threshold warning) and network hiccups get a bounded retry
// instead of an immediate error toast.

import { toast } from "sonner";

const SLOW_MS = 1500;

export type TimedOptions = {
  label: string;
  slowMs?: number;
  onError?: (err: unknown) => void;
};

export function withTiming<A extends any[], R>(
  fn: (...args: A) => Promise<R>,
  opts: TimedOptions,
) {
  return async (...args: A): Promise<R> => {
    const started = performance.now();
    try {
      const res = await fn(...args);
      const took = performance.now() - started;
      if (took > (opts.slowMs ?? SLOW_MS)) {
        // eslint-disable-next-line no-console
        console.warn(`[dashboard] slow query "${opts.label}" took ${took.toFixed(0)}ms`);
      } else {
        // eslint-disable-next-line no-console
        console.debug(`[dashboard] ${opts.label} ${took.toFixed(0)}ms`);
      }
      return res;
    } catch (err) {
      const took = performance.now() - started;
      // eslint-disable-next-line no-console
      console.error(`[dashboard] "${opts.label}" failed after ${took.toFixed(0)}ms`, err);
      opts.onError?.(err);
      throw err;
    }
  };
}

// Bounded exponential backoff — 2 retries, max 4s wait.
export const dashboardRetry = (failureCount: number, err: unknown): boolean => {
  const msg = String((err as Error)?.message ?? err ?? "").toLowerCase();
  if (msg.includes("unauthorized") || msg.includes("forbidden") || msg.includes("not authorized")) return false;
  return failureCount < 2;
};

export const dashboardRetryDelay = (attempt: number): number =>
  Math.min(500 * 2 ** attempt, 4000);

let lastToastAt = 0;
export function notifyQueryError(label: string, err: unknown) {
  const now = Date.now();
  if (now - lastToastAt < 5000) return; // rate-limit noisy toasts
  lastToastAt = now;
  const msg = (err as Error)?.message ?? "অজানা ত্রুটি";
  toast.error(`${label} লোড হয়নি`, { description: msg });
}