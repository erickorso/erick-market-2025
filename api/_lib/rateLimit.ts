import type { VercelRequest, VercelResponse } from "@vercel/node";

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Seconds until the window frees up. Only meaningful when blocked. */
  retryAfter: number;
};

type Bucket = { hits: number[] };

const buckets = new Map<string, Bucket>();

/** Stops the map growing without bound on a long-lived instance. */
const MAX_TRACKED_KEYS = 10_000;

/**
 * Fixed-cost sliding window.
 *
 * Deliberately in-process: on Vercel each instance keeps its own counters, so
 * the effective limit is (limit x live instances). That is enough to stop a
 * single client hammering one instance, but it is not a distributed limiter —
 * the CDN cache headers on the public routes are what actually protect the
 * upstream quota. Swap this for Redis if exact global limits ever matter.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): RateLimitResult {
  if (buckets.size > MAX_TRACKED_KEYS) buckets.clear();

  const cutoff = now - windowMs;
  const bucket = buckets.get(key) ?? { hits: [] };
  const hits = bucket.hits.filter((at) => at > cutoff);

  if (hits.length >= limit) {
    buckets.set(key, { hits });
    return {
      allowed: false,
      limit,
      remaining: 0,
      retryAfter: Math.max(1, Math.ceil((hits[0] + windowMs - now) / 1000)),
    };
  }

  hits.push(now);
  buckets.set(key, { hits });
  return {
    allowed: true,
    limit,
    remaining: limit - hits.length,
    retryAfter: 0,
  };
}

/** Test seam — the module keeps counters for the life of the process. */
export function resetRateLimits() {
  buckets.clear();
}

/**
 * Caller identity. `x-forwarded-for` is set by Vercel's proxy; the leftmost
 * entry is the client. Falls back to a single shared bucket rather than
 * letting an unidentifiable caller through unlimited.
 */
export function clientKey(req: VercelRequest): string {
  const forwarded = req.headers["x-forwarded-for"];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const ip = raw?.split(",")[0]?.trim();
  return ip || req.socket?.remoteAddress || "unknown";
}

/**
 * Applies the limit and writes the standard headers. Returns true when the
 * request was rejected, so handlers can `if (enforceRateLimit(...)) return;`.
 */
export function enforceRateLimit(
  req: VercelRequest,
  res: VercelResponse,
  { limit, windowMs }: { limit: number; windowMs: number },
): boolean {
  const result = rateLimit(clientKey(req), limit, windowMs);

  res.setHeader("X-RateLimit-Limit", String(result.limit));
  res.setHeader("X-RateLimit-Remaining", String(result.remaining));

  if (result.allowed) return false;

  res.setHeader("Retry-After", String(result.retryAfter));
  res.status(429).json({ error: "rate limit exceeded" });
  return true;
}
