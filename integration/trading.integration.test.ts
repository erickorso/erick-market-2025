import { neon } from "@neondatabase/serverless";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { executeTrade, loadPortfolio, upsertUser } from "../api/_lib/store";
import { currentMonthKey } from "../api/_lib/month";

type TestSql = ReturnType<typeof neon>;

const testUrl = process.env.DATABASE_URL_TEST;
if (!testUrl) {
  throw new Error(
    "DATABASE_URL_TEST is required. Point it to a dedicated Neon test branch; production DATABASE_URL is never used.",
  );
}

// The integration process deliberately uses only the explicitly named test URL.
process.env.DATABASE_URL = testUrl;
const sql = neon(testUrl) as TestSql;
const month = currentMonthKey();
const auth0Sub = `auth0|integration-${process.pid}-${Date.now()}`;

let userId = "";

async function resetPortfolio() {
  await sql`DELETE FROM trades WHERE user_id = ${userId}`;
  await sql`DELETE FROM positions WHERE user_id = ${userId}`;
  await sql`DELETE FROM league_scores WHERE user_id = ${userId}`;
  await sql`DELETE FROM portfolios WHERE user_id = ${userId}`;
  await sql`
    INSERT INTO portfolios (user_id, month, cash)
    VALUES (${userId}, ${month}, 10000)
  `;
}

describe("Neon trading integration", () => {
  beforeAll(async () => {
    const existing = await sql`
      DELETE FROM users
      WHERE auth0_sub = ${auth0Sub}
      RETURNING id
    `;
    if (existing.length) {
      throw new Error("Unexpected collision in integration user id");
    }

    const user = await upsertUser({
      sub: auth0Sub,
      email: "integration@example.com",
      name: "Integration Trader",
    });
    userId = user.id;
  });

  beforeEach(async () => {
    await resetPortfolio();
  });

  afterAll(async () => {
    if (userId) {
      await sql`DELETE FROM users WHERE id = ${userId}`;
    }
  });

  it("persists a buy and calculates the average cost", async () => {
    await executeTrade({
      userId,
      side: "buy",
      symbol: "AAPL",
      company: "Apple Inc.",
      qty: 2,
      price: 100,
    });
    const result = await executeTrade({
      userId,
      side: "buy",
      symbol: "AAPL",
      company: "Apple Inc.",
      qty: 3,
      price: 200,
    });

    expect(result.cash).toBe(9_200);
    expect(result.positions).toEqual([
      { symbol: "AAPL", company: "Apple Inc.", qty: 5, avg_cost: 160 },
    ]);

    const trades = await sql`
      SELECT side, symbol, qty, price
      FROM trades
      WHERE user_id = ${userId}
      ORDER BY created_at, id
    `;
    expect(trades).toHaveLength(2);
  });

  it("supports partial and full sells", async () => {
    await executeTrade({
      userId,
      side: "buy",
      symbol: "MSFT",
      company: "Microsoft Corp.",
      qty: 5,
      price: 100,
    });

    const partial = await executeTrade({
      userId,
      side: "sell",
      symbol: "MSFT",
      company: "Microsoft Corp.",
      qty: 2,
      price: 120,
    });
    expect(partial.cash).toBe(9_740);
    expect(partial.positions[0]?.qty).toBe(3);

    const complete = await executeTrade({
      userId,
      side: "sell",
      symbol: "MSFT",
      company: "Microsoft Corp.",
      qty: 3,
      price: 120,
    });
    expect(complete.cash).toBe(10_100);
    expect(complete.positions).toEqual([]);
  });

  it("rejects trades that exceed funds or holdings", async () => {
    await expect(
      executeTrade({
        userId,
        side: "buy",
        symbol: "AAPL",
        company: "Apple Inc.",
        qty: 101,
        price: 100,
      }),
    ).rejects.toThrow("Insufficient funds");

    await expect(
      executeTrade({
        userId,
        side: "sell",
        symbol: "AAPL",
        company: "Apple Inc.",
        qty: 1,
        price: 100,
      }),
    ).rejects.toThrow("Not enough shares");

    const result = await loadPortfolio(userId);
    expect(result.cash).toBe(10_000);
    expect(result.positions).toEqual([]);
  });

  it("allows only one of two overspending buys to succeed", async () => {
    const results = await Promise.allSettled([
      executeTrade({
        userId,
        side: "buy",
        symbol: "AAPL",
        company: "Apple Inc.",
        qty: 60,
        price: 100,
      }),
      executeTrade({
        userId,
        side: "buy",
        symbol: "MSFT",
        company: "Microsoft Corp.",
        qty: 60,
        price: 100,
      }),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);

    const result = await loadPortfolio(userId);
    expect(result.cash).toBe(4_000);
    expect(result.positions).toHaveLength(1);
    expect(result.positions[0]?.qty).toBe(60);

    const trades = await sql`
      SELECT COUNT(*)::int AS count
      FROM trades
      WHERE user_id = ${userId}
    `;
    expect(Number(trades[0]?.count)).toBe(1);
  });
});
