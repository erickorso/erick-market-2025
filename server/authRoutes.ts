import type { IncomingMessage, ServerResponse } from "node:http";
import { verifyBearer } from "../api/_lib/auth";
import { dbConfigured } from "../api/_lib/db";
import { currentMonthKey } from "../api/_lib/month";
import {
  ensurePortfolio,
  executeTrade,
  getLeagueBoard,
  updateDisplayName,
  upsertLeagueScore,
  upsertUser,
} from "../api/_lib/store";

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  return JSON.parse(raw) as unknown;
}

function authHeader(req: IncomingMessage) {
  const h = req.headers.authorization;
  return typeof h === "string" ? h : undefined;
}

export async function handleAuthApi(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
): Promise<boolean> {
  if (!pathname.startsWith("/api/me") &&
      !pathname.startsWith("/api/portfolio") &&
      !pathname.startsWith("/api/trade") &&
      !pathname.startsWith("/api/league")) {
    return false;
  }

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization",
  );

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return true;
  }

  try {
    if (!dbConfigured()) {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "DATABASE_URL not configured" }));
      return true;
    }

    if (pathname.startsWith("/api/league") && req.method === "GET") {
      const url = new URL(req.url || "/", "http://127.0.0.1");
      const month = url.searchParams.get("month") || currentMonthKey();
      const board = await getLeagueBoard(month);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(board));
      return true;
    }

    const auth = await verifyBearer(authHeader(req));
    const user = await upsertUser(auth);

    if (pathname.startsWith("/api/me")) {
      if (req.method === "GET") {
        const portfolio = await ensurePortfolio(user.id);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ user, portfolio }));
        return true;
      }
      if (req.method === "POST") {
        const body = (await readBody(req)) as { displayName?: string };
        const updated =
          typeof body.displayName === "string"
            ? await updateDisplayName(user.id, body.displayName)
            : user;
        const portfolio = await ensurePortfolio(updated.id);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ user: updated, portfolio }));
        return true;
      }
    }

    if (pathname.startsWith("/api/portfolio") && req.method === "GET") {
      const portfolio = await ensurePortfolio(user.id);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(portfolio));
      return true;
    }

    if (pathname.startsWith("/api/trade") && req.method === "POST") {
      const body = (await readBody(req)) as {
        side?: string;
        symbol?: string;
        company?: string;
        qty?: number;
        price?: number;
      };
      const side =
        body.side === "sell" ? "sell" : body.side === "buy" ? "buy" : null;
      if (!side || !body.symbol) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "side and symbol required" }));
        return true;
      }
      const portfolio = await executeTrade({
        userId: user.id,
        side,
        symbol: body.symbol,
        company: body.company?.trim() || body.symbol,
        qty: Number(body.qty),
        price: Number(body.price),
      });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(portfolio));
      return true;
    }

    if (pathname.startsWith("/api/league") && req.method === "POST") {
      const body = (await readBody(req)) as {
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
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(board));
      return true;
    }

    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "method not allowed" }));
    return true;
  } catch (err) {
    const status =
      typeof err === "object" &&
      err &&
      "status" in err &&
      typeof (err as { status: unknown }).status === "number"
        ? (err as { status: number }).status
        : 500;
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: err instanceof Error ? err.message : "request failed",
      }),
    );
    return true;
  }
}
