import type { VercelRequest, VercelResponse } from "@vercel/node";
import { dbConfigured } from "./_lib/db.js";
import { handleOptions, sendError, setCors } from "./_lib/http.js";
import { withAuth } from "./_lib/middleware.js";
import { currentMonthKey } from "./_lib/month.js";
import { getLeagueBoard, upsertLeagueScore } from "./_lib/store.js";

async function getHandler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (handleOptions(req, res)) return;
  try {
    if (!dbConfigured()) {
      res.status(503).json({ error: "DATABASE_URL not configured" });
      return;
    }
    const month =
      typeof req.query.month === "string" && req.query.month
        ? req.query.month
        : currentMonthKey();
    const board = await getLeagueBoard(month);
    res.status(200).json(board);
  } catch (err) {
    sendError(res, err);
  }
}

const postHandler = withAuth(async (req, res, { user }) => {
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
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET" || req.method === "OPTIONS") {
    await getHandler(req, res);
    return;
  }
  if (req.method === "POST") {
    await postHandler(req, res);
    return;
  }
  setCors(res);
  res.status(405).json({ error: "method not allowed" });
}
