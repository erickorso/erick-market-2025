import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getBearer, verifyBearer } from "./_lib/auth";
import { dbConfigured } from "./_lib/db";
import { handleOptions, sendError, setCors } from "./_lib/http";
import { executeTrade, upsertUser } from "./_lib/store";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (handleOptions(req, res)) return;

  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "method not allowed" });
      return;
    }
    if (!dbConfigured()) {
      res.status(503).json({ error: "DATABASE_URL not configured" });
      return;
    }
    const auth = await verifyBearer(getBearer(req));
    const user = await upsertUser(auth);
    const body = (typeof req.body === "string"
      ? JSON.parse(req.body)
      : req.body) as {
      side?: string;
      symbol?: string;
      company?: string;
      qty?: number;
      price?: number;
    };

    const side = body.side === "sell" ? "sell" : body.side === "buy" ? "buy" : null;
    if (!side || !body.symbol) {
      res.status(400).json({ error: "side and symbol required" });
      return;
    }

    const portfolio = await executeTrade({
      userId: user.id,
      side,
      symbol: body.symbol,
      company: body.company?.trim() || body.symbol,
      qty: Number(body.qty),
      price: Number(body.price),
    });
    res.status(200).json(portfolio);
  } catch (err) {
    sendError(res, err);
  }
}
