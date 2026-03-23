import { lazy } from "react";
import type { ComponentType } from "react";

type LazyFactory<T extends ComponentType<Record<string, unknown>>> = () => Promise<{ default: T }>;

/**
 * Wraps React.lazy with a simple retry (useful for transient network hiccups).
 * No complex recovery logic — the SW NetworkFirst strategy handles stale builds.
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

    throw lastError;
  });
}
