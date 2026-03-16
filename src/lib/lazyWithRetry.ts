import { lazy } from "react";
import type { ComponentType } from "react";

type LazyFactory<T extends ComponentType<Record<string, unknown>>> = () => Promise<{ default: T }>;

const LAZY_RELOAD_FLAG = "__st_lazy_chunk_reload_attempted";

/**
 * Helps recover from transient chunk-load failures (e.g. after a new deploy while
 * a tab is still open) by retrying the dynamic import.
 */
export function lazyWithRetry<T extends ComponentType<Record<string, unknown>>>(
  factory: LazyFactory<T>,
  options?: {
    retries?: number;
    retryDelayMs?: number;
  }
) {
  const retries = options?.retries ?? 2;
  const retryDelayMs = options?.retryDelayMs ?? 600;

  return lazy(async () => {
    let lastError: unknown;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await factory();
      } catch (err) {
        lastError = err;
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, retryDelayMs));
        }
      }
    }

    // In production, a hard reload usually fixes stale chunk URLs after an update.
    if (!import.meta.env.DEV && typeof window !== "undefined") {
      try {
        if (!sessionStorage.getItem(LAZY_RELOAD_FLAG)) {
          sessionStorage.setItem(LAZY_RELOAD_FLAG, "1");
          window.location.reload();
        }
      } catch {
        // ignore
      }
    }

    throw lastError;
  });
}
