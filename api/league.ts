import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getBearer, verifyBearer } from "./_lib/auth";
import { dbConfigured } from "./_lib/db";
import { handleOptions, sendError, setCors } from "./_lib/http";
import {
  getLeagueBoard,
  upsertLeagueScore,
  upsertUser,
} from "./_lib/store";
import { currentMonthKey } from "./_lib/month";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (handleOptions(req, res)) return;

  try {
    if (!dbConfigured()) {
      res.status(503).json({ error: "DATABASE_URL not configured" });
      return;
    }

    if (req.method === "GET") {
      const month =
        typeof req.query.month === "string" && req.query.month
          ? req.query.month
          : currentMonthKey();
      const board = await getLeagueBoard(month);
      res.status(200).json(board);
      return;
    }

    if (req.method === "POST") {
      const auth = await verifyBearer(getBearer(req));
      const user = await upsertUser(auth);
      const body = (typeof req.body === "string"
        ? JSON.parse(req.body)
        : req.body) as {
        equity?: number;
        cash?: number;
        invested?: number;
        pnl?: number;
        pnlPercent?: number;
      };
      await upsertLeagueScore({
        userId: user.id,
        equity: Number(body.equity ?? 0),
        cash: Number(body.cash ?? 0),
        invested: Number(body.invested ?? 0),
        pnl: Number(body.pnl ?? 0),
        pnlPct: Number(body.pnlPercent ?? 0),
      });
      const board = await getLeagueBoard();
      res.status(200).json(board);
      return;
    }

    res.status(405).json({ error: "method not allowed" });
  } catch (err) {
    sendError(res, err);
  }
}
