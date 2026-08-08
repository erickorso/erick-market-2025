import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getBearer, verifyBearer } from "./_lib/auth";
import { dbConfigured } from "./_lib/db";
import { handleOptions, sendError, setCors } from "./_lib/http";
import { ensurePortfolio, upsertUser } from "./_lib/store";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (handleOptions(req, res)) return;

  try {
    if (req.method !== "GET") {
      res.status(405).json({ error: "method not allowed" });
      return;
    }
    if (!dbConfigured()) {
      res.status(503).json({ error: "DATABASE_URL not configured" });
      return;
    }
    const auth = await verifyBearer(getBearer(req));
    const user = await upsertUser(auth);
    const portfolio = await ensurePortfolio(user.id);
    res.status(200).json(portfolio);
  } catch (err) {
    sendError(res, err);
  }
}
