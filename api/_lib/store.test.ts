import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ensurePortfolio,
  executeTrade,
  getLeagueBoard,
  loadPortfolio,
  syncLeagueScoreFromPortfolio,
  updateDisplayName,
  upsertLeagueScore,
  upsertUser,
} from "./store";
import { INITIAL_FUND } from "./month";

const fetchLivePrices = vi.hoisted(() => vi.fn());

/**
 * Neon's client is a tagged template. This stands in for it: every call shifts
 * the next queued result and records the statement, so tests assert on the
 * mapping and the guards rather than on SQL text.
 */
const db = vi.hoisted(() => {
  const queue: Record<string, unknown>[][] = [];
  const calls: { text: string; values: unknown[] }[] = [];

  const sql = (strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ text: strings.join(" ? "), values });
    return Promise.resolve(queue.shift() ?? []);
  };

  return { queue, calls, sql };
});

vi.mock("./db.js", () => ({ getSql: () => db.sql }));
vi.mock("./prices.js", () => ({ fetchLivePrices }));

/** Enqueue results in the order the function under test will consume them. */
function queue(...results: Record<string, unknown>[][]) {
  db.queue.push(...results);
}

/** ensureMonthArchive short-circuits when the previous month is already archived. */
const ARCHIVE_EXISTS = [{ month: "2026-07" }];

function statement(index: number) {
  return db.calls[index]?.text ?? "";
}

beforeEach(() => {
  db.queue.length = 0;
  db.calls.length = 0;
  fetchLivePrices.mockReset().mockResolvedValue(new Map());
  delete process.env.FINNHUB_API_KEY;
});

describe("upsertUser", () => {
  const row = {
    id: "u1",
    auth0_sub: "auth0|1",
    email: "trader@example.com",
    display_name: "Erick",
  };

  it("returns the stored user row", async () => {
    queue([row]);
    expect(await upsertUser({ sub: "auth0|1" })).toEqual(row);
  });

  it("prefers the nickname as display name", async () => {
    queue([row]);
    await upsertUser({
      sub: "auth0|1",
      nickname: "erickorso",
      name: "Erick Vargas",
      email: "trader@example.com",
    });

    expect(db.calls[0].values).toContain("erickorso");
  });

  it("falls back to the full name", async () => {
    queue([row]);
    await upsertUser({
      sub: "auth0|1",
      name: "Erick Vargas",
      email: "trader@example.com",
    });

    expect(db.calls[0].values).toContain("Erick Vargas");
  });

  it("falls back to the local part of the email", async () => {
    queue([row]);
    await upsertUser({ sub: "auth0|1", email: "trader@example.com" });

    expect(db.calls[0].values).toContain("trader");
  });

  it("falls back to Trader when the token carries nothing usable", async () => {
    queue([row]);
    await upsertUser({ sub: "auth0|1" });

    expect(db.calls[0].values).toContain("Trader");
  });

  // The placeholder is a seed for a new row only. Passing it to the conflict
  // branch renamed every returning user to "Trader" on their next request,
  // which is what happened when the bearer became a claim-less access token.
  it("never writes the placeholder over an existing name", async () => {
    queue([row]);
    await upsertUser({ sub: "auth0|1" });

    const [insert, update] = db.calls[0].values.slice(-2);
    expect(insert).toBe("Trader");
    expect(update).toBeNull();
  });

  it("does update the stored name when the token does carry one", async () => {
    queue([row]);
    await upsertUser({ sub: "auth0|1", name: "Erick Vargas" });

    const [insert, update] = db.calls[0].values.slice(-2);
    expect(insert).toBe("Erick Vargas");
    expect(update).toBe("Erick Vargas");
  });

  it("ignores a whitespace-only nickname", async () => {
    queue([row]);
    await upsertUser({ sub: "auth0|1", nickname: "   ", name: "Erick" });

    expect(db.calls[0].values).toContain("Erick");
  });

  it("truncates a display name to the column width", async () => {
    queue([row]);
    await upsertUser({ sub: "auth0|1", name: "x".repeat(200) });

    const display = db.calls[0].values.find(
      (v) => typeof v === "string" && v.startsWith("x"),
    ) as string;
    expect(display).toHaveLength(64);
  });

  it("stores a null email rather than undefined", async () => {
    queue([row]);
    await upsertUser({ sub: "auth0|1" });

    expect(db.calls[0].values).toContain(null);
  });
});

describe("updateDisplayName", () => {
  it("stores the trimmed name", async () => {
    queue([{ id: "u1", display_name: "Erick" }]);
    await updateDisplayName("u1", "  Erick  ");

    expect(db.calls[0].values).toContain("Erick");
  });

  it("rejects a name that is too short", async () => {
    await expect(updateDisplayName("u1", "E")).rejects.toMatchObject({
      status: 400,
    });
    expect(db.calls).toHaveLength(0);
  });

  it("rejects a name that is only whitespace", async () => {
    await expect(updateDisplayName("u1", "    ")).rejects.toThrow(/too short/i);
  });

  it("truncates to the column width", async () => {
    queue([{ id: "u1" }]);
    await updateDisplayName("u1", "y".repeat(200));

    expect(db.calls[0].values[0] as string).toHaveLength(64);
  });
});

describe("loadPortfolio", () => {
  it("maps the cash and positions", async () => {
    queue(
      [{ cash: "7856.40" }],
      [{ symbol: "AAPL", company: "Apple Inc.", qty: "10", avg_cost: "208.6" }],
    );

    const portfolio = await loadPortfolio("u1", "2026-08");

    expect(portfolio.month).toBe("2026-08");
    expect(portfolio.cash).toBe(7856.4);
    expect(portfolio.positions).toEqual([
      { symbol: "AAPL", company: "Apple Inc.", qty: 10, avg_cost: 208.6 },
    ]);
  });

  it("coerces the numeric columns Postgres returns as strings", async () => {
    queue(
      [{ cash: "1000" }],
      [{ symbol: "A", company: "A", qty: "3", avg_cost: "1.5" }],
    );

    const portfolio = await loadPortfolio("u1", "2026-08");

    expect(typeof portfolio.cash).toBe("number");
    expect(typeof portfolio.positions[0].qty).toBe("number");
  });

  it("falls back to the opening fund when no row exists yet", async () => {
    queue([], []);
    expect((await loadPortfolio("u1", "2026-08")).cash).toBe(INITIAL_FUND);
  });

  it("returns an empty position list for a fresh account", async () => {
    queue([{ cash: "10000" }], []);
    expect((await loadPortfolio("u1", "2026-08")).positions).toEqual([]);
  });
});

describe("ensurePortfolio", () => {
  it("opens the month at the starting fund when none exists", async () => {
    queue(
      ARCHIVE_EXISTS, // month already archived
      [], // no portfolio row
      [], // insert
      [{ cash: "10000" }], // loadPortfolio cash
      [], // loadPortfolio positions
    );

    const portfolio = await ensurePortfolio("u1");

    expect(portfolio.cash).toBe(INITIAL_FUND);
    expect(
      db.calls.some((c) => c.text.includes("INSERT INTO portfolios")),
    ).toBe(true);
  });

  it("leaves an existing month alone", async () => {
    queue(
      ARCHIVE_EXISTS,
      [{ cash: "5000" }], // portfolio already open
      [{ cash: "5000" }],
      [],
    );

    await ensurePortfolio("u1");

    expect(
      db.calls.some((c) => c.text.includes("INSERT INTO portfolios")),
    ).toBe(false);
  });

  it("archives the previous month the first time it is seen", async () => {
    queue(
      [], // nothing archived yet
      [{ user_id: "winner" }], // top score of last month
      [], // insert archive
      [], // no portfolio row
      [], // insert
      [{ cash: "10000" }],
      [],
    );

    await ensurePortfolio("u1");

    const archiveInsert = db.calls.find((c) =>
      c.text.includes("INSERT INTO league_months"),
    );
    expect(archiveInsert?.values).toContain("winner");
  });

  it("archives a month with no scores as having no winner", async () => {
    queue([], [], [], [], [], [{ cash: "10000" }], []);

    await ensurePortfolio("u1");

    const archiveInsert = db.calls.find((c) =>
      c.text.includes("INSERT INTO league_months"),
    );
    expect(archiveInsert?.values).toContain(null);
  });
});

describe("executeTrade", () => {
  const buy = {
    userId: "u1",
    side: "buy" as const,
    symbol: "AAPL",
    company: "Apple Inc.",
    qty: 2,
  };

  function queueEnsure() {
    queue(ARCHIVE_EXISTS, [{ cash: "10000" }], [{ cash: "10000" }], []);
  }

  beforeEach(() => {
    // Every trade is priced from the quote feed now, so it has to answer.
    fetchLivePrices.mockResolvedValue(new Map([["AAPL", 100]]));
  });

  // The client used to send its own execution price and the server booked it
  // verbatim. A hand-written request could buy a million shares at a cent and
  // take the league with it.
  it("prices the trade from the quote feed, not from the request", async () => {
    fetchLivePrices.mockResolvedValue(new Map([["AAPL", 313.33]]));
    queueEnsure();
    queue([{ user_id: "u1" }], [{ cash: "9373.34" }], []);

    await executeTrade({ ...buy, price: 0.01 } as never);

    const cte = db.calls.find((c) => c.text.includes("WITH paid AS"));
    expect(cte?.values).toContain(313.33);
    expect(cte?.values).not.toContain(0.01);
  });

  it("charges the quoted price times quantity, ignoring any sent cost", async () => {
    fetchLivePrices.mockResolvedValue(new Map([["AAPL", 250]]));
    queueEnsure();
    queue([{ user_id: "u1" }], [{ cash: "9500" }], []);

    await executeTrade({ ...buy, qty: 2, price: 1 } as never);

    const cte = db.calls.find((c) => c.text.includes("WITH paid AS"));
    expect(cte?.values).toContain(500);
  });

  // Falling back to the caller's number when the feed is down would reopen the
  // hole exactly when nobody is watching. Refusing to trade is the safe answer.
  // One upstream hiccup should not cost a user their trade. Safe to retry only
  // because the quote runs before any write.
  it("retries the quote before giving up", async () => {
    fetchLivePrices
      .mockResolvedValueOnce(new Map())
      .mockResolvedValueOnce(new Map([["AAPL", 200]]));
    queueEnsure();
    queue([{ user_id: "u1" }], [{ cash: "9600" }], []);

    await executeTrade(buy);

    expect(fetchLivePrices).toHaveBeenCalledTimes(2);
    const cte = db.calls.find((c) => c.text.includes("WITH paid AS"));
    expect(cte?.values).toContain(200);
  });

  it("gives up after a bounded number of attempts", async () => {
    fetchLivePrices.mockResolvedValue(new Map());

    await expect(executeTrade(buy)).rejects.toMatchObject({ status: 503 });

    expect(fetchLivePrices).toHaveBeenCalledTimes(3);
  });

  it("refuses to trade when the market cannot be priced", async () => {
    fetchLivePrices.mockResolvedValue(new Map());

    await expect(executeTrade(buy)).rejects.toMatchObject({
      status: 503,
      code: "price_unavailable",
    });
  });

  it("writes nothing when it cannot price the trade", async () => {
    fetchLivePrices.mockResolvedValue(new Map());

    await executeTrade(buy).catch(() => null);

    expect(db.calls).toHaveLength(0);
  });

  it("prices a sell the same way", async () => {
    fetchLivePrices.mockResolvedValue(new Map([["AAPL", 400]]));
    queueEnsure();
    queue([{ user_id: "u1", qty: "3" }], [{ cash: "10800" }], []);

    await executeTrade({
      ...buy,
      side: "sell",
      qty: 2,
      price: 99_999,
    } as never);

    const cte = db.calls.find((c) => c.text.includes("WITH sold AS"));
    expect(cte?.values).toContain(400);
    expect(cte?.values).not.toContain(99_999);
  });

  it("validates the input before touching the database", async () => {
    await expect(executeTrade({ ...buy, qty: -1 })).rejects.toMatchObject({
      status: 400,
    });
    expect(db.calls).toHaveLength(0);
  });

  it("rejects an unknown side", async () => {
    await expect(
      executeTrade({ ...buy, side: "hold" as unknown as "buy" }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("charges the cash and returns the new portfolio on a buy", async () => {
    queueEnsure();
    queue(
      [{ user_id: "u1" }], // the CTE matched, so cash covered it
      [{ cash: "9800" }],
      [{ symbol: "AAPL", company: "Apple Inc.", qty: "2", avg_cost: "100" }],
    );

    const portfolio = await executeTrade(buy);

    expect(portfolio.cash).toBe(9800);
    expect(portfolio.positions[0].qty).toBe(2);
  });

  it("settles the whole buy in one statement", async () => {
    queueEnsure();
    queue([{ user_id: "u1" }], [{ cash: "9800" }], []);

    await executeTrade(buy);

    const cte = db.calls.find((c) => c.text.includes("WITH paid AS"));
    expect(cte?.text).toContain("INSERT INTO positions");
    expect(cte?.text).toContain("INSERT INTO trades");
  });

  it("refuses a buy the cash cannot cover", async () => {
    queueEnsure();
    queue([]); // the guarded UPDATE matched no rows

    await expect(executeTrade(buy)).rejects.toMatchObject({
      status: 400,
      message: "Insufficient funds",
    });
  });

  it("credits the cash on a sell", async () => {
    queueEnsure();
    queue(
      [{ user_id: "u1", qty: "8" }],
      [], // the cleanup DELETE
      [{ cash: "10200" }],
      [{ symbol: "AAPL", company: "Apple Inc.", qty: "8", avg_cost: "100" }],
    );

    const portfolio = await executeTrade({ ...buy, side: "sell" });

    expect(portfolio.cash).toBe(10200);
  });

  it("refuses a sell of more shares than are held", async () => {
    queueEnsure();
    queue([]); // the guarded UPDATE matched no rows

    await expect(executeTrade({ ...buy, side: "sell" })).rejects.toMatchObject({
      status: 400,
      message: "Not enough shares",
    });
  });

  it("clears a position that reaches zero", async () => {
    queueEnsure();
    queue([{ user_id: "u1", qty: "0" }], [], [{ cash: "10200" }], []);

    await executeTrade({ ...buy, side: "sell" });

    expect(db.calls.some((c) => c.text.includes("DELETE FROM positions"))).toBe(
      true,
    );
  });

  it("normalises the symbol before storing it", async () => {
    queueEnsure();
    queue([{ user_id: "u1" }], [{ cash: "9800" }], []);

    await executeTrade({ ...buy, symbol: "aapl" });

    const cte = db.calls.find((c) => c.text.includes("WITH paid AS"));
    expect(cte?.values).toContain("AAPL");
  });
});

// Sub-statements in a WITH share one snapshot, so the DELETE meant to drop a
// fully sold position could not see the UPDATE that emptied it.
describe("a fully sold position", () => {
  it("is never returned as a holding, whatever the row says", async () => {
    queue([{ cash: "10000" }], []);

    await loadPortfolio("u1", "2026-08");

    expect(statement(1)).toMatch(/qty > 1e-9/);
  });

  it("is cleaned up in its own statement, after the sell", async () => {
    fetchLivePrices.mockResolvedValue(new Map([["AAPL", 100]]));
    queue(ARCHIVE_EXISTS, [{ cash: "10000" }], [{ cash: "10000" }], []);
    queue([{ user_id: "u1", qty: "0" }], [{ cash: "10200" }], [], []);

    await executeTrade({
      userId: "u1",
      side: "sell",
      symbol: "AAPL",
      company: "Apple Inc.",
      qty: 2,
    });

    const sell = db.calls.findIndex((c) => c.text.includes("WITH sold AS"));
    const cleanup = db.calls.findIndex((c) =>
      c.text.includes("DELETE FROM positions"),
    );
    expect(cleanup).toBeGreaterThan(sell);
    expect(db.calls[sell].text).not.toMatch(/DELETE FROM positions/);
  });
});

describe("syncLeagueScoreFromPortfolio", () => {
  function queueEnsureWithPosition() {
    queue(
      ARCHIVE_EXISTS,
      [{ cash: "5000" }],
      [{ cash: "5000" }],
      [{ symbol: "AAPL", company: "Apple Inc.", qty: "10", avg_cost: "100" }],
    );
  }

  it("marks positions to the live price", async () => {
    queueEnsureWithPosition();
    fetchLivePrices.mockResolvedValue(new Map([["AAPL", 150]]));
    queue([]);

    const score = await syncLeagueScoreFromPortfolio("u1");

    expect(score.invested).toBe(1_500);
    expect(score.equity).toBe(6_500);
  });

  it("falls back to the cost basis when a symbol is unquoted", async () => {
    queueEnsureWithPosition();
    fetchLivePrices.mockResolvedValue(new Map());
    queue([]);

    const score = await syncLeagueScoreFromPortfolio("u1");

    expect(score.invested).toBe(1_000);
  });

  it("computes pnl against the opening fund", async () => {
    queueEnsureWithPosition();
    fetchLivePrices.mockResolvedValue(new Map([["AAPL", 150]]));
    queue([]);

    const score = await syncLeagueScoreFromPortfolio("u1");

    expect(score.pnl).toBe(6_500 - INITIAL_FUND);
  });

  it("never trusts a client-supplied score", async () => {
    queueEnsureWithPosition();
    fetchLivePrices.mockResolvedValue(new Map([["AAPL", 150]]));
    queue([]);

    const score = await upsertLeagueScore({
      userId: "u1",
      equity: 999_999,
      pnl: 999_999,
    });

    expect(score.equity).toBe(6_500);
  });

  it("upserts the score so a resync does not duplicate the row", async () => {
    queueEnsureWithPosition();
    queue([]);

    await syncLeagueScoreFromPortfolio("u1");

    const insert = db.calls.find((c) =>
      c.text.includes("INSERT INTO league_scores"),
    );
    expect(insert?.text).toContain("ON CONFLICT");
  });
});

describe("getLeagueBoard", () => {
  const entryRow = {
    user_id: "u1",
    display_name: "Erick",
    month: "2026-08",
    equity: "11842",
    cash: "1000",
    invested: "10842",
    pnl: "1842",
    pnl_pct: "18.42",
    updated_at: "2026-08-08T00:00:00.000Z",
  };

  it("maps the ranked entries", async () => {
    queue(ARCHIVE_EXISTS, [entryRow], []);

    const board = await getLeagueBoard("2026-08");

    expect(board.mode).toBe("shared");
    expect(board.entries).toHaveLength(1);
    expect(board.entries[0]).toMatchObject({
      playerId: "u1",
      name: "Erick",
      equity: 11842,
      pnlPercent: 18.42,
    });
  });

  it("returns an ISO timestamp whatever the driver hands back", async () => {
    queue(ARCHIVE_EXISTS, [entryRow], []);

    const board = await getLeagueBoard("2026-08");
    expect(board.entries[0].updatedAt).toBe("2026-08-08T00:00:00.000Z");
  });

  it("ranks by equity, capped at 100", async () => {
    queue(ARCHIVE_EXISTS, [entryRow], []);
    await getLeagueBoard("2026-08");

    const query = db.calls.find((c) =>
      c.text.includes("FROM league_scores ls"),
    );
    expect(query?.text).toContain("ORDER BY ls.equity DESC");
    expect(query?.text).toContain("LIMIT 100");
  });

  it("has no previous winner in the first month", async () => {
    queue(ARCHIVE_EXISTS, [entryRow], []);
    expect((await getLeagueBoard("2026-08")).previousWinner).toBeNull();
  });

  it("carries the previous winner through", async () => {
    queue(
      ARCHIVE_EXISTS,
      [entryRow],
      [
        {
          winner_user_id: "u2",
          display_name: "Marta",
          equity: "12480",
          pnl_pct: "24.8",
        },
      ],
    );

    const board = await getLeagueBoard("2026-08");

    expect(board.previousWinner).toMatchObject({
      playerId: "u2",
      name: "Marta",
      equity: 12480,
      pnlPercent: 24.8,
      month: "2026-07",
    });
  });

  // The client renders these with .toFixed(), so they must always be numbers.
  it("defaults a winner's missing figures to zero", async () => {
    queue(ARCHIVE_EXISTS, [], [{ winner_user_id: "u2" }]);

    const board = await getLeagueBoard("2026-08");

    expect(board.previousWinner?.equity).toBe(0);
    expect(board.previousWinner?.pnlPercent).toBe(0);
    expect(board.previousWinner?.name).toBe("Unknown");
  });

  it("returns an empty board for a month with no scores", async () => {
    queue(ARCHIVE_EXISTS, [], []);

    const board = await getLeagueBoard("2026-08");
    expect(board.entries).toEqual([]);
  });

  it("archives the previous month before reading the board", async () => {
    queue(ARCHIVE_EXISTS, [], []);
    await getLeagueBoard("2026-08");

    expect(statement(0)).toContain("FROM league_months");
  });
});
