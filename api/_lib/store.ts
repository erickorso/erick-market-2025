import type { AuthUser } from "./auth";
import { getSql } from "./db";
import { INITIAL_FUND, currentMonthKey, previousMonthKey } from "./month";

export type DbUser = {
  id: string;
  auth0_sub: string;
  email: string | null;
  display_name: string;
};

export type PositionRow = {
  symbol: string;
  company: string;
  qty: number;
  avg_cost: number;
};

export type PortfolioPayload = {
  month: string;
  cash: number;
  positions: PositionRow[];
};

export async function upsertUser(auth: AuthUser): Promise<DbUser> {
  const sql = getSql();
  const display =
    auth.nickname?.trim() ||
    auth.name?.trim() ||
    auth.email?.split("@")[0] ||
    "Trader";
  const rows = await sql`
    INSERT INTO users (auth0_sub, email, display_name)
    VALUES (${auth.sub}, ${auth.email ?? null}, ${display.slice(0, 64)})
    ON CONFLICT (auth0_sub) DO UPDATE SET
      email = COALESCE(EXCLUDED.email, users.email),
      display_name = COALESCE(NULLIF(EXCLUDED.display_name, ''), users.display_name)
    RETURNING id, auth0_sub, email, display_name
  `;
  return rows[0] as DbUser;
}

export async function updateDisplayName(
  userId: string,
  displayName: string,
): Promise<DbUser> {
  const sql = getSql();
  const name = displayName.trim().slice(0, 64);
  if (name.length < 2) throw Object.assign(new Error("Name too short"), { status: 400 });
  const rows = await sql`
    UPDATE users SET display_name = ${name}
    WHERE id = ${userId}
    RETURNING id, auth0_sub, email, display_name
  `;
  return rows[0] as DbUser;
}

async function ensureMonthArchive(month: string) {
  const sql = getSql();
  const prev = previousMonthKey(month);
  const existing = await sql`
    SELECT month FROM league_months WHERE month = ${prev} LIMIT 1
  `;
  if (existing.length) return;

  const scores = await sql`
    SELECT user_id, equity FROM league_scores
    WHERE month = ${prev}
    ORDER BY equity DESC
    LIMIT 1
  `;
  const winner = scores[0]?.user_id ?? null;
  await sql`
    INSERT INTO league_months (month, winner_user_id)
    VALUES (${prev}, ${winner})
    ON CONFLICT (month) DO NOTHING
  `;
}

export async function ensurePortfolio(userId: string): Promise<PortfolioPayload> {
  const sql = getSql();
  const month = currentMonthKey();
  await ensureMonthArchive(month);

  const existing = await sql`
    SELECT cash FROM portfolios WHERE user_id = ${userId} AND month = ${month}
  `;
  if (!existing.length) {
    await sql`
      INSERT INTO portfolios (user_id, month, cash)
      VALUES (${userId}, ${month}, ${INITIAL_FUND})
      ON CONFLICT (user_id, month) DO NOTHING
    `;
  }

  return loadPortfolio(userId, month);
}

export async function loadPortfolio(
  userId: string,
  month = currentMonthKey(),
): Promise<PortfolioPayload> {
  const sql = getSql();
  const cashRows = await sql`
    SELECT cash FROM portfolios WHERE user_id = ${userId} AND month = ${month}
  `;
  const cash = Number(cashRows[0]?.cash ?? INITIAL_FUND);
  const posRows = await sql`
    SELECT symbol, company, qty, avg_cost
    FROM positions
    WHERE user_id = ${userId} AND month = ${month}
    ORDER BY symbol
  `;
  return {
    month,
    cash,
    positions: posRows.map((p) => ({
      symbol: String(p.symbol),
      company: String(p.company),
      qty: Number(p.qty),
      avg_cost: Number(p.avg_cost),
    })),
  };
}

export async function executeTrade(input: {
  userId: string;
  side: "buy" | "sell";
  symbol: string;
  company: string;
  qty: number;
  price: number;
}): Promise<PortfolioPayload> {
  const sql = getSql();
  const month = currentMonthKey();
  await ensurePortfolio(input.userId);

  const symbol = input.symbol.toUpperCase().trim();
  const qty = input.qty;
  const price = input.price;
  if (!symbol || !Number.isFinite(qty) || qty <= 0) {
    throw Object.assign(new Error("Invalid quantity"), { status: 400 });
  }
  if (!Number.isFinite(price) || price <= 0) {
    throw Object.assign(new Error("Invalid price"), { status: 400 });
  }

  const portfolio = await loadPortfolio(input.userId, month);
  const cost = qty * price;

  if (input.side === "buy") {
    if (portfolio.cash < cost) {
      throw Object.assign(new Error("Insufficient funds"), { status: 400 });
    }
    const existing = portfolio.positions.find((p) => p.symbol === symbol);
    const newQty = (existing?.qty ?? 0) + qty;
    const newAvg = existing
      ? (existing.avg_cost * existing.qty + cost) / newQty
      : price;

    await sql`
      UPDATE portfolios SET cash = cash - ${cost}, updated_at = now()
      WHERE user_id = ${input.userId} AND month = ${month}
    `;
    await sql`
      INSERT INTO positions (user_id, symbol, month, company, qty, avg_cost)
      VALUES (${input.userId}, ${symbol}, ${month}, ${input.company}, ${newQty}, ${newAvg})
      ON CONFLICT (user_id, symbol, month) DO UPDATE SET
        company = EXCLUDED.company,
        qty = EXCLUDED.qty,
        avg_cost = EXCLUDED.avg_cost
    `;
  } else {
    const existing = portfolio.positions.find((p) => p.symbol === symbol);
    if (!existing || existing.qty < qty) {
      throw Object.assign(new Error("Not enough shares"), { status: 400 });
    }
    const remaining = existing.qty - qty;
    await sql`
      UPDATE portfolios SET cash = cash + ${cost}, updated_at = now()
      WHERE user_id = ${input.userId} AND month = ${month}
    `;
    if (remaining <= 1e-9) {
      await sql`
        DELETE FROM positions
        WHERE user_id = ${input.userId} AND symbol = ${symbol} AND month = ${month}
      `;
    } else {
      await sql`
        UPDATE positions SET qty = ${remaining}
        WHERE user_id = ${input.userId} AND symbol = ${symbol} AND month = ${month}
      `;
    }
  }

  await sql`
    INSERT INTO trades (user_id, month, symbol, side, qty, price)
    VALUES (${input.userId}, ${month}, ${symbol}, ${input.side}, ${qty}, ${price})
  `;

  return loadPortfolio(input.userId, month);
}

export async function upsertLeagueScore(input: {
  userId: string;
  equity: number;
  cash: number;
  invested: number;
  pnl: number;
  pnlPct: number;
}) {
  const sql = getSql();
  const month = currentMonthKey();
  await sql`
    INSERT INTO league_scores (user_id, month, equity, cash, invested, pnl, pnl_pct, updated_at)
    VALUES (
      ${input.userId}, ${month}, ${input.equity}, ${input.cash},
      ${input.invested}, ${input.pnl}, ${input.pnlPct}, now()
    )
    ON CONFLICT (user_id, month) DO UPDATE SET
      equity = EXCLUDED.equity,
      cash = EXCLUDED.cash,
      invested = EXCLUDED.invested,
      pnl = EXCLUDED.pnl,
      pnl_pct = EXCLUDED.pnl_pct,
      updated_at = now()
  `;
}

export async function getLeagueBoard(month = currentMonthKey()) {
  const sql = getSql();
  await ensureMonthArchive(month);
  const rows = await sql`
    SELECT
      ls.user_id,
      u.display_name,
      ls.month,
      ls.equity,
      ls.cash,
      ls.invested,
      ls.pnl,
      ls.pnl_pct,
      ls.updated_at
    FROM league_scores ls
    JOIN users u ON u.id = ls.user_id
    WHERE ls.month = ${month}
    ORDER BY ls.equity DESC
    LIMIT 100
  `;
  const prev = previousMonthKey(month);
  const winnerRows = await sql`
    SELECT lm.winner_user_id, u.display_name, ls.equity, ls.pnl_pct
    FROM league_months lm
    LEFT JOIN users u ON u.id = lm.winner_user_id
    LEFT JOIN league_scores ls ON ls.user_id = lm.winner_user_id AND ls.month = lm.month
    WHERE lm.month = ${prev}
    LIMIT 1
  `;
  const w = winnerRows[0];
  return {
    mode: "shared" as const,
    month,
    entries: rows.map((r) => ({
      playerId: String(r.user_id),
      name: String(r.display_name),
      month: String(r.month),
      equity: Number(r.equity),
      cash: Number(r.cash),
      invested: Number(r.invested),
      pnl: Number(r.pnl),
      pnlPercent: Number(r.pnl_pct),
      updatedAt: new Date(String(r.updated_at)).toISOString(),
    })),
    previousWinner: w?.winner_user_id
      ? {
          playerId: String(w.winner_user_id),
          name: String(w.display_name ?? "Unknown"),
          month: prev,
          equity: Number(w.equity ?? 0),
          cash: 0,
          invested: 0,
          pnl: 0,
          pnlPercent: Number(w.pnl_pct ?? 0),
          updatedAt: new Date().toISOString(),
        }
      : null,
  };
}
