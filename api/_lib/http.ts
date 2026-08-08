import type { VercelRequest, VercelResponse } from "@vercel/node";

const DEFAULT_ORIGINS = [
  "https://erick-market-2025.vercel.app",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:4173",
];

/** Extra origins for previews, comma separated. Set on Vercel per environment. */
function allowedOrigins(): string[] {
  const extra = (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  return [...DEFAULT_ORIGINS, ...extra];
}

/**
 * Echoes the caller's origin when it is on the allowlist, plus Vercel preview
 * deployments of this project. A request from anywhere else simply gets no
 * CORS header, which is what blocks it in the browser.
 */
export function setCors(res: VercelResponse, origin?: string) {
  const allowed = allowedOrigins();
  const isPreview = Boolean(
    origin && /^https:\/\/erick-market-2025-[a-z0-9-]+\.vercel\.app$/.test(origin),
  );

  if (origin && (allowed.includes(origin) || isPreview)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  // Responses differ per origin, so caches must key on it.
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export function originOf(req: VercelRequest): string | undefined {
  const origin = req.headers.origin;
  return Array.isArray(origin) ? origin[0] : origin;
}

export function handleOptions(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    setCors(res, originOf(req));
    res.status(204).end();
    return true;
  }
  return false;
}

/** Seconds the CDN may serve a cached copy, plus a stale-while-revalidate tail. */
export function setCdnCache(
  res: VercelResponse,
  { sMaxAge, staleWhileRevalidate }: { sMaxAge: number; staleWhileRevalidate: number },
) {
  res.setHeader(
    "Cache-Control",
    `public, max-age=0, s-maxage=${sMaxAge}, stale-while-revalidate=${staleWhileRevalidate}`,
  );
}

export function statusOf(err: unknown): number {
  return typeof err === "object" &&
    err &&
    "status" in err &&
    typeof (err as { status: unknown }).status === "number"
    ? (err as { status: number }).status
    : 500;
}

export function sendError(res: VercelResponse, err: unknown) {
  const message = err instanceof Error ? err.message : "request failed";
  res.status(statusOf(err)).json({ error: message });
}
