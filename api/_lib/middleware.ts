import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getBearer, verifyBearer, type AuthUser } from "./auth.js";
import { dbConfigured } from "./db.js";
import { handleOptions, sendError, setCors } from "./http.js";
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

/**
 * API middleware: CORS + OPTIONS + JWT verify + Neon user upsert.
 * Use on private handlers (me, portfolio, trade, league POST).
 */
export function withAuth(handler: AuthedHandler) {
  return async (req: VercelRequest, res: VercelResponse) => {
    setCors(res);
    if (handleOptions(req, res)) return;

    try {
      if (!dbConfigured()) {
        res.status(503).json({ error: "DATABASE_URL not configured" });
        return;
      }
      const auth = await verifyBearer(getBearer(req));
      const user = await upsertUser(auth);
      await handler(req, res, { auth, user });
    } catch (err) {
      sendError(res, err);
    }
  };
}

/**
 * CORS middleware without auth (public routes that still need OPTIONS).
 */
export function withPublic(handler: AuthedHandler | ((
  req: VercelRequest,
  res: VercelResponse,
) => Promise<void> | void)) {
  return async (req: VercelRequest, res: VercelResponse) => {
    setCors(res);
    if (handleOptions(req, res)) return;
    try {
      if (!dbConfigured()) {
        res.status(503).json({ error: "DATABASE_URL not configured" });
        return;
      }
      await (handler as (req: VercelRequest, res: VercelResponse) => Promise<void>)(
        req,
        res,
      );
    } catch (err) {
      sendError(res, err);
    }
  };
}
