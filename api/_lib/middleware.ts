import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getBearer, verifyBearer, type AuthUser } from "./auth.js";
import { dbConfigured } from "./db.js";
import {
  handleOptions,
  originOf,
  sendError,
  setCors,
  statusOf,
} from "./http.js";
import { buildLog, logRequest } from "./logger.js";
import { enforceRateLimit } from "./rateLimit.js";
import { upsertUser, type DbUser } from "./store.js";

export type AuthContext = {
  auth: AuthUser;
  user: DbUser;
};

export type AuthedHandler = (
  req: VercelRequest,
  res: VercelResponse,
  ctx: AuthContext,
) => Promise<void> | void;

/** Writes are cheap per user but worth bounding; reads get a looser budget. */
const AUTHED_LIMIT = { limit: 60, windowMs: 60_000 };
const PUBLIC_LIMIT = { limit: 120, windowMs: 60_000 };

/**
 * API middleware: CORS + OPTIONS + rate limit + JWT verify + Neon user upsert,
 * with one structured log line per request.
 * Use on private handlers (me, portfolio, trade, league POST).
 */
export function withAuth(handler: AuthedHandler) {
  return async (req: VercelRequest, res: VercelResponse) => {
    const startedAt = Date.now();
    setCors(res, originOf(req));
    if (handleOptions(req, res)) return;

    try {
      if (enforceRateLimit(req, res, AUTHED_LIMIT)) {
        logRequest(buildLog(req, 429, startedAt));
        return;
      }
      if (!dbConfigured()) {
        res.status(503).json({ error: "DATABASE_URL not configured" });
        logRequest(buildLog(req, 503, startedAt));
        return;
      }
      const auth = await verifyBearer(getBearer(req));
      const user = await upsertUser(auth);
      await handler(req, res, { auth, user });
      logRequest(buildLog(req, res.statusCode, startedAt));
    } catch (err) {
      sendError(res, err);
      logRequest(buildLog(req, statusOf(err), startedAt, err));
    }
  };
}

/**
 * CORS middleware without auth (public routes that still need OPTIONS).
 */
export function withPublic(
  handler:
    | AuthedHandler
    | ((req: VercelRequest, res: VercelResponse) => Promise<void> | void),
) {
  return async (req: VercelRequest, res: VercelResponse) => {
    const startedAt = Date.now();
    setCors(res, originOf(req));
    if (handleOptions(req, res)) return;

    try {
      if (enforceRateLimit(req, res, PUBLIC_LIMIT)) {
        logRequest(buildLog(req, 429, startedAt));
        return;
      }
      if (!dbConfigured()) {
        res.status(503).json({ error: "DATABASE_URL not configured" });
        logRequest(buildLog(req, 503, startedAt));
        return;
      }
      await (
        handler as (req: VercelRequest, res: VercelResponse) => Promise<void>
      )(req, res);
      logRequest(buildLog(req, res.statusCode, startedAt));
    } catch (err) {
      sendError(res, err);
      logRequest(buildLog(req, statusOf(err), startedAt, err));
    }
  };
}
