import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getBearer, verifyBearer } from "./_lib/auth";
import { dbConfigured } from "./_lib/db";
import { handleOptions, sendError, setCors } from "./_lib/http";
import { ensurePortfolio, updateDisplayName, upsertUser } from "./_lib/store";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (handleOptions(req, res)) return;

  try {
    if (!dbConfigured()) {
      res.status(503).json({ error: "DATABASE_URL not configured" });
      return;
    }
    const auth = await verifyBearer(getBearer(req));
    const user = await upsertUser(auth);

    if (req.method === "GET") {
      const portfolio = await ensurePortfolio(user.id);
      res.status(200).json({ user, portfolio });
      return;
    }

    if (req.method === "POST") {
      const body = (typeof req.body === "string"
        ? JSON.parse(req.body)
        : req.body) as { displayName?: string };
      const updated =
        typeof body?.displayName === "string"
          ? await updateDisplayName(user.id, body.displayName)
          : user;
      const portfolio = await ensurePortfolio(updated.id);
      res.status(200).json({ user: updated, portfolio });
      return;
    }

    res.status(405).json({ error: "method not allowed" });
  } catch (err) {
    sendError(res, err);
  }
}
