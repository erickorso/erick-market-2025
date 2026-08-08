import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Client telemetry sink: browser errors and Web Vitals land here and go out as
 * structured JSON on stdout, which is where Vercel's log drains pick them up.
 * That makes production failures greppable without signing up for anything;
 * pointing the same stream at Sentry later is a drain configuration, not a
 * code change.
 *
 * Fully self-contained — no relative imports (Vercel ESM cold-start crash).
 * The CORS/rate-limit block mirrors api/_lib; change it here and in
 * api/quotes.ts, api/hot.ts and api/detail.ts together.
 */

const ALLOWED_ORIGINS = [
  "https://erick-market-2025.vercel.app",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:4173",
  ...(process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
];
const PREVIEW_ORIGIN = /^https:\/\/erick-market-2025-[a-z0-9-]+\.vercel\.app$/;
// Tighter than the read routes: a page should emit a handful of beacons, not a stream.
const RATE_LIMIT = { limit: 30, windowMs: 60_000 };
const rateHits = new Map<string, number[]>();

const MAX_EVENTS_PER_BATCH = 20;
const MAX_BODY_BYTES = 32_000;
const MAX_STRING = 500;
const MAX_STACK = 4_000;

function setCors(req: VercelRequest, res: VercelResponse) {
  const origin = Array.isArray(req.headers.origin)
    ? req.headers.origin[0]
    : req.headers.origin;
  if (origin && (ALLOWED_ORIGINS.includes(origin) || PREVIEW_ORIGIN.test(origin))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function rateLimited(req: VercelRequest, res: VercelResponse): boolean {
  const forwarded = req.headers["x-forwarded-for"];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const key = raw?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const hits = (rateHits.get(key) ?? []).filter(
    (at) => at > now - RATE_LIMIT.windowMs,
  );

  if (rateHits.size > 10_000) rateHits.clear();
  res.setHeader("X-RateLimit-Limit", String(RATE_LIMIT.limit));

  if (hits.length >= RATE_LIMIT.limit) {
    rateHits.set(key, hits);
    res.setHeader("X-RateLimit-Remaining", "0");
    res.setHeader(
      "Retry-After",
      String(Math.max(1, Math.ceil((hits[0] + RATE_LIMIT.windowMs - now) / 1000))),
    );
    res.status(429).json({ error: "rate limit exceeded" });
    return true;
  }

  hits.push(now);
  rateHits.set(key, hits);
  res.setHeader("X-RateLimit-Remaining", String(RATE_LIMIT.limit - hits.length));
  return false;
}

/** Non-cryptographic; only needs to group requests without storing an IP. */
function hash(value: string): string {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function str(value: unknown, max = MAX_STRING): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

function num(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

type ClientEvent = {
  kind: "error" | "vital";
  name: string;
  message?: string;
  stack?: string;
  componentStack?: string;
  value?: number;
  rating?: string;
  url?: string;
  at?: string;
  sessionId?: string;
  count?: number;
};

/**
 * The browser is not a trusted client: accept only the shape we log, at
 * bounded sizes, so nobody can push arbitrary volume into the drain.
 */
function parseEvent(raw: unknown): ClientEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const input = raw as Record<string, unknown>;

  const kind =
    input.kind === "vital" ? "vital" : input.kind === "error" ? "error" : null;
  const name = str(input.name, 120);
  if (!kind || !name) return null;

  const rating =
    input.rating === "good" ||
    input.rating === "needs-improvement" ||
    input.rating === "poor"
      ? (input.rating as string)
      : undefined;
  const count = num(input.count);

  return {
    kind,
    name,
    message: str(input.message),
    stack: str(input.stack, MAX_STACK),
    componentStack: str(input.componentStack, MAX_STACK),
    value: num(input.value),
    rating,
    url: str(input.url, 300),
    at: str(input.at, 40),
    sessionId: str(input.sessionId, 64),
    count: count && count > 0 ? Math.min(Math.floor(count), 1_000) : undefined,
  };
}

function parseBody(body: unknown): ClientEvent[] {
  let parsed = body;
  if (typeof parsed === "string") {
    if (parsed.length > MAX_BODY_BYTES) return [];
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return [];
    }
  }

  const list = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { events?: unknown })?.events)
      ? (parsed as { events: unknown[] }).events
      : null;
  if (!list) return [];

  return list
    .slice(0, MAX_EVENTS_PER_BATCH)
    .map(parseEvent)
    .filter((e): e is ClientEvent => e !== null);
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }
  if (rateLimited(req, res)) return;

  const events = parseBody(req.body);
  if (events.length === 0) {
    res.status(400).json({ error: "no valid events" });
    return;
  }

  const forwarded = req.headers["x-forwarded-for"];
  const rawIp = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const client = hash(rawIp?.split(",")[0]?.trim() ?? "unknown");
  const userAgent = str(req.headers["user-agent"], 200);

  for (const event of events) {
    const line = JSON.stringify({
      level: event.kind === "error" ? "error" : "info",
      source: "client",
      client,
      userAgent,
      ...event,
    });
    if (event.kind === "error") console.error(line);
    else console.log(line);
  }

  // The browser sends this with sendBeacon and never reads the body.
  res.status(204).end();
}
