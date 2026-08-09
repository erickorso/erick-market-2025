import type { AuthUser } from "./auth.js";
import { getSql } from "./db.js";
import { INITIAL_FUND, currentMonthKey, previousMonthKey } from "./month.js";
import { fetchLivePrices } from "./prices.js";
import { computeEquityFromBooks, parseTradeInput } from "./tradeValidation.js";

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
  // Null when the token carried no profile claims at all. "Trader" is only a
  // seed for a brand-new row: writing it on conflict overwrote the real name
  // of every existing user on every request.
  const claimed =
    auth.nickname?.trim() ||
    auth.name?.trim() ||
    auth.email?.split("@")[0] ||
    null;
  const named = claimed ? claimed.slice(0, 64) : null;
  const rows = await sql`
    INSERT INTO users (auth0_sub, email, display_name)
    VALUES (${auth.sub}, ${auth.email ?? null}, ${named ?? "Trader"})
    ON CONFLICT (auth0_sub) DO UPDATE SET
      email = COALESCE(EXCLUDED.email, users.email),
      display_name = COALESCE(${named}, users.display_name)
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
  if (name.length < 2)
    throw Object.assign(new Error("Name too short"), { status: 400 });
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

export async function ensurePortfolio(
  userId: string,
): Promise<PortfolioPayload> {
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
  const trade = parseTradeInput(input);
  const sql = getSql();
  const month = currentMonthKey();
  await ensurePortfolio(input.userId);

  const { symbol, company, qty, price, side } = trade;
  const cost = qty * price;

  if (side === "buy") {
    // Single statement: if cash UPDATE matches 0 rows, CTE chain inserts nothing.
    const rows = await sql`
      WITH paid AS (
        UPDATE portfolios
        SET cash = cash - ${cost}, updated_at = now()
        WHERE user_id = ${input.userId}
          AND month = ${month}
          AND cash >= ${cost}
        RETURNING user_id
      ),
      pos AS (
        INSERT INTO positions (user_id, symbol, month, company, qty, avg_cost)
        SELECT ${input.userId}, ${symbol}, ${month}, ${company}, ${qty}, ${price}
        FROM paid
        ON CONFLICT (user_id, symbol, month) DO UPDATE SET
          company = EXCLUDED.company,
          qty = positions.qty + EXCLUDED.qty,
          avg_cost = (
            (positions.avg_cost * positions.qty)
            + (EXCLUDED.avg_cost * EXCLUDED.qty)
          ) / NULLIF(positions.qty + EXCLUDED.qty, 0)
        RETURNING user_id
      ),
      led AS (
        INSERT INTO trades (user_id, month, symbol, side, qty, price)
        SELECT ${input.userId}, ${month}, ${symbol}, ${side}, ${qty}, ${price}
        FROM paid
        RETURNING id
      )
      SELECT user_id FROM paid
    `;
    if (!rows.length) {
      throw Object.assign(new Error("Insufficient funds"), { status: 400 });
    }
  } else {
    const rows = await sql`
      WITH sold AS (
        UPDATE positions
        SET qty = qty - ${qty}
        WHERE user_id = ${input.userId}
          AND symbol = ${symbol}
          AND month = ${month}
          AND qty >= ${qty}
        RETURNING user_id, qty
      ),
      cleaned AS (
        DELETE FROM positions
        WHERE user_id = ${input.userId}
          AND symbol = ${symbol}
          AND month = ${month}
          AND qty <= 1e-9
          AND EXISTS (SELECT 1 FROM sold)
        RETURNING user_id
      ),
      paid AS (
        UPDATE portfolios
        SET cash = cash + ${cost}, updated_at = now()
        WHERE user_id = ${input.userId}
          AND month = ${month}
          AND EXISTS (SELECT 1 FROM sold)
        RETURNING user_id
      ),
      led AS (
        INSERT INTO trades (user_id, month, symbol, side, qty, price)
        SELECT ${input.userId}, ${month}, ${symbol}, ${side}, ${qty}, ${price}
        FROM sold
        RETURNING id
      )
      SELECT user_id FROM sold
    `;
    if (!rows.length) {
      throw Object.assign(new Error("Not enough shares"), { status: 400 });
    }
  }

  return loadPortfolio(input.userId, month);
}

export async function syncLeagueScoreFromPortfolio(userId: string) {
  const sql = getSql();
  const month = currentMonthKey();
  const portfolio = await ensurePortfolio(userId);
  const prices = await fetchLivePrices(
    portfolio.positions.map((p) => p.symbol),
    process.env.FINNHUB_API_KEY,
  );

  const marked = portfolio.positions.map((p) => ({
    qty: p.qty,
    price: prices.get(p.symbol.toUpperCase()) ?? p.avg_cost,
  }));
  const score = computeEquityFromBooks(portfolio.cash, marked, INITIAL_FUND);

  await sql`
    INSERT INTO league_scores (user_id, month, equity, cash, invested, pnl, pnl_pct, updated_at)
    VALUES (
      ${userId}, ${month}, ${score.equity}, ${score.cash},
      ${score.invested}, ${score.pnl}, ${score.pnlPct}, now()
    )
    ON CONFLICT (user_id, month) DO UPDATE SET
      equity = EXCLUDED.equity,
      cash = EXCLUDED.cash,
      invested = EXCLUDED.invested,
      pnl = EXCLUDED.pnl,
      pnl_pct = EXCLUDED.pnl_pct,
      updated_at = now()
  `;
  return score;
}

/** @deprecated Prefer syncLeagueScoreFromPortfolio — ignores client numbers. */
export async function upsertLeagueScore(input: {
  userId: string;
  equity?: number;
  cash?: number;
  invested?: number;
  pnl?: number;
  pnlPct?: number;
}) {
  return syncLeagueScoreFromPortfolio(input.userId);
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
