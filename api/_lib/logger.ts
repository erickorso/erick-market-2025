import type { VercelRequest } from "@vercel/node";

export type RequestLog = {
  level: "info" | "warn" | "error";
  route: string;
  method: string;
  status: number;
  ms: number;
  requestId: string;
  /** Hashed, so logs never carry a raw client IP. */
  client: string;
  error?: string;
};

/** Non-cryptographic; only needs to be stable and non-reversible enough to group by. */
function hash(value: string): string {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export function requestId(req: VercelRequest): string {
  const header = req.headers["x-vercel-id"] ?? req.headers["x-request-id"];
  const value = Array.isArray(header) ? header[0] : header;
  return value ?? "-";
}

/**
 * One structured line per request on stdout, which is where Vercel's log
 * drains pick it up. JSON so it stays queryable without a parser.
 */
export function logRequest(entry: RequestLog) {
  const line = JSON.stringify(entry);
  if (entry.level === "error") console.error(line);
  else if (entry.level === "warn") console.warn(line);
  else console.log(line);
}

export function buildLog(
  req: VercelRequest,
  status: number,
  startedAt: number,
  error?: unknown,
): RequestLog {
  const forwarded = req.headers["x-forwarded-for"];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return {
    level: status >= 500 ? "error" : status >= 400 ? "warn" : "info",
    route: (req.url ?? "").split("?")[0] || "unknown",
    method: req.method ?? "GET",
    status,
    ms: Date.now() - startedAt,
    requestId: requestId(req),
    client: hash(raw?.split(",")[0]?.trim() ?? "unknown"),
    ...(error
      ? { error: error instanceof Error ? error.message : String(error) }
      : {}),
  };
}
