/** Thrown when an operation is aborted because it exceeded its timeout. */
export class TimeoutError extends Error {
  constructor(label: string, timeoutMs: number) {
    super(`${label} timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
  }
}

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Runs `fn` with an AbortController, racing it against a timeout. On timeout the
 * controller is aborted (so an in-flight `fetch` passed `signal` stops immediately)
 * and a TimeoutError is thrown, so callers never wait past `timeoutMs`.
 */
export async function withTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  label: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      // Reject with our own TimeoutError first so callers see a typed error even if
      // aborting `fn`'s in-flight request also rejects (e.g. fetch's AbortError).
      reject(new TimeoutError(label, timeoutMs));
      controller.abort();
    }, timeoutMs);
    if (typeof timer.unref === 'function') timer.unref();
  });

  try {
    return await Promise.race([fn(controller.signal), timeout]);
  } finally {
    clearTimeout(timer!);
  }
}
