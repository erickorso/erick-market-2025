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
  // Body ignored — score is recalculated server-side from portfolio + live prices.
  const sync = await upsertLeagueScore({ userId: user.id });
  const board = await getLeagueBoard();
  // Refusing to publish a score it cannot price is only half the job: a rank
  // that quietly stops moving is its own kind of lie. The client is told.
  res.status(200).json({
    ...board,
    published: sync.published,
    ...(sync.published ? {} : { unpriced: sync.unpriced }),
  });
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
