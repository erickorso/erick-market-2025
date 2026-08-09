/** Exponential backoff with jitter, shared by anything that calls upstream. */

export type RetryOptions = {
  /** Extra attempts after the first. 0 means "try once, never retry". */
  retries?: number;
  /** Base wait before the first retry; doubled by `backoffFactor` after that. */
  delayMs?: number;
  backoffFactor?: number;
  /** Random 0..jitterMs added to every wait, so callers do not resynchronise. */
  jitterMs?: number;
  /** Ceiling on the total time spent retrying, so a caller cannot outlive its
   *  own request budget. A wait that would cross it ends the loop instead. */
  budgetMs?: number;
  /** Called between attempts, for logging or telling the user what is going on. */
  onRetry?: (info: { attempt: number; waitMs: number; error: unknown }) => void;
  /** Injectable for tests, so a retry suite does not sleep in real time. */
  sleep?: (ms: number) => Promise<void>;
  /** Injectable so a test can assert on the schedule, not on a range. */
  random?: () => number;
};

const defaultSleep = (ms: number) =>
  new Promise<void>((r) => setTimeout(r, ms));

/**
 * `shouldRetry` is required, with no default. Blind retries are safe for a read
 * and a way to charge someone twice for a write, and a helper this convenient
 * ends up wrapping both.
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  shouldRetry: (error: unknown) => boolean,
  options: RetryOptions = {},
): Promise<T> {
  const {
    retries = 2,
    delayMs = 300,
    backoffFactor = 2,
    jitterMs = 200,
    budgetMs = Infinity,
    onRetry,
    sleep = defaultSleep,
    random = Math.random,
  } = options;

  const startedAt = Date.now();
  let spent = 0;

  for (let attempt = 0; ; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      if (attempt >= retries || !shouldRetry(error)) throw error;

      const wait = Math.round(
        delayMs * Math.pow(backoffFactor, attempt) + random() * jitterMs,
      );
      // Checked against the elapsed time, not just the sum of the waits: the
      // attempts themselves are usually what eats a timeout budget.
      spent = Date.now() - startedAt;
      if (spent + wait > budgetMs) throw error;

      onRetry?.({ attempt: attempt + 1, waitMs: wait, error });
      await sleep(wait);
    }
  }
}
