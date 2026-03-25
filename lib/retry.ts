import type { RetryOptions } from "@/lib/types";

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {
    retries: 4,
    minDelayMs: 500,
    maxDelayMs: 4000
  }
): Promise<T> {
  let attempt = 0;
  let lastError: unknown;

  while (attempt <= options.retries) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const retryable =
        typeof error === "object" &&
        error !== null &&
        "retryable" in error &&
        (error as { retryable?: boolean }).retryable === true;

      if (!retryable) {
        throw error;
      }

      if (attempt === options.retries) break;
      const jitter = Math.floor(Math.random() * 120);
      const delay = Math.min(options.maxDelayMs, options.minDelayMs * 2 ** attempt) + jitter;
      await sleep(delay);
      attempt += 1;
    }
  }

  throw lastError;
}
