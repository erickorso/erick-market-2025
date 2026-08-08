import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  archiveLocalMonth,
  clearPlayer,
  computeEquity,
  currentMonthKey,
  fetchLeagueBoard,
  getLocalArchive,
  getLocalBoard,
  joinLeague,
  loadPlayer,
  newPlayerId,
  portfolioMarketValue,
  previousMonthKey,
  savePlayer,
  submitLeagueScore,
  upsertLocalScore,
} from "./leagueService";
import { INITIAL_FUND_AMOUNT } from "../constants";
import type { EnrichedStock, PortfolioItem } from "../types";

function position(over: Partial<PortfolioItem> = {}): PortfolioItem {
  return {
    stockId: "aapl",
    company: "Apple (AAPL)",
    quantity: 10,
    purchasePrice: 100,
    totalCost: 1000,
    ...over,
  };
}

function stock(over: Partial<EnrichedStock> = {}): EnrichedStock {
  return {
    id: "aapl",
    company: "Apple (AAPL)",
    price: 100,
    chartData: [],
    ...over,
  };
}

describe("month keys", () => {
  it("formats as YYYY-MM with a padded month", () => {
    expect(currentMonthKey(new Date(2026, 2, 15))).toBe("2026-03");
  });

  it("steps back one month", () => {
    expect(previousMonthKey(new Date(2026, 2, 15))).toBe("2026-02");
  });

  it("rolls the year back across January", () => {
    expect(previousMonthKey(new Date(2026, 0, 5))).toBe("2025-12");
  });
});

describe("portfolioMarketValue", () => {
  it("marks positions to the live price", () => {
    expect(
      portfolioMarketValue([position({ quantity: 10 })], [stock({ price: 150 })]),
    ).toBe(1500);
  });

  it("matches by company when the id differs", () => {
    expect(
      portfolioMarketValue(
        [position({ stockId: "other" })],
        [stock({ id: "different", price: 200 })],
      ),
    ).toBe(2000);
  });

  it("falls back to the cost basis for unquoted positions", () => {
    expect(
      portfolioMarketValue([position({ purchasePrice: 100 })], []),
    ).toBe(1000);
  });

  it("is zero for an empty portfolio", () => {
    expect(portfolioMarketValue([], [stock()])).toBe(0);
  });
});

describe("computeEquity", () => {
  it("reports break-even for an untouched account", () => {
    const result = computeEquity(INITIAL_FUND_AMOUNT, [], []);

    expect(result.equity).toBe(INITIAL_FUND_AMOUNT);
    expect(result.pnl).toBe(0);
    expect(result.pnlPercent).toBe(0);
  });

  it("adds cash to the marked-to-market positions", () => {
    const result = computeEquity(
      5_000,
      [position({ quantity: 10 })],
      [stock({ price: 150 })],
    );

    expect(result.cash).toBe(5_000);
    expect(result.invested).toBe(1_500);
    expect(result.equity).toBe(6_500);
  });

  it("computes pnl against the starting fund", () => {
    const result = computeEquity(
      INITIAL_FUND_AMOUNT,
      [position({ quantity: 10 })],
      [stock({ price: 150 })],
    );

    expect(result.pnl).toBe(1_500);
    expect(result.pnlPercent).toBeCloseTo(15, 5);
  });

  it("reports a negative pnl when the account is down", () => {
    const result = computeEquity(0, [position({ quantity: 10 })], [
      stock({ price: 500 }),
    ]);

    expect(result.pnl).toBeLessThan(0);
    expect(result.pnlPercent).toBeLessThan(0);
  });
});

describe("player identity", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("has no player until one is saved", () => {
    expect(loadPlayer()).toBeNull();
  });

  it("round-trips a saved player", () => {
    const player = { id: "p1", name: "Erick", pinHash: "abc" };
    savePlayer(player);

    expect(loadPlayer()).toEqual(player);
  });

  it("rejects a stored player missing its fields", () => {
    localStorage.setItem("erick-market.player.v1", JSON.stringify({ id: "p1" }));
    expect(loadPlayer()).toBeNull();
  });

  it("survives corrupt storage", () => {
    localStorage.setItem("erick-market.player.v1", "{not json");
    expect(loadPlayer()).toBeNull();
  });

  it("clears the player", () => {
    savePlayer({ id: "p1", name: "Erick", pinHash: "abc" });
    clearPlayer();

    expect(loadPlayer()).toBeNull();
  });

  it("mints unique ids", () => {
    const ids = new Set(Array.from({ length: 50 }, () => newPlayerId()));
    expect(ids.size).toBe(50);
  });
});

describe("local board", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("is empty for a fresh month", () => {
    expect(getLocalBoard("2026-08")).toEqual([]);
  });

  it("records a score", () => {
    upsertLocalScore({
      playerId: "p1",
      name: "Erick",
      month: "2026-08",
      equity: 11_000,
      cash: 1_000,
      invested: 10_000,
      pnl: 1_000,
      pnlPercent: 10,
      updatedAt: new Date(2026, 7, 8).toISOString(),
    });

    const board = getLocalBoard("2026-08");
    expect(board).toHaveLength(1);
    expect(board[0].name).toBe("Erick");
  });

  it("replaces a player's earlier score rather than duplicating them", () => {
    const base = {
      playerId: "p1",
      name: "Erick",
      month: "2026-08",
      cash: 0,
      invested: 0,
      updatedAt: new Date(2026, 7, 8).toISOString(),
    };

    upsertLocalScore({ ...base, equity: 11_000, pnl: 1_000, pnlPercent: 10 });
    upsertLocalScore({ ...base, equity: 12_000, pnl: 2_000, pnlPercent: 20 });

    const board = getLocalBoard("2026-08");
    expect(board).toHaveLength(1);
    expect(board[0].equity).toBe(12_000);
  });

  it("ranks the board by equity", () => {
    const base = {
      month: "2026-08",
      cash: 0,
      invested: 0,
      pnl: 0,
      pnlPercent: 0,
      updatedAt: new Date(2026, 7, 8).toISOString(),
    };

    upsertLocalScore({ ...base, playerId: "p1", name: "Low", equity: 9_000 });
    upsertLocalScore({ ...base, playerId: "p2", name: "High", equity: 13_000 });

    expect(getLocalBoard("2026-08")[0].name).toBe("High");
  });

  it("keeps months apart", () => {
    upsertLocalScore({
      playerId: "p1",
      name: "Erick",
      month: "2026-07",
      equity: 1,
      cash: 0,
      invested: 0,
      pnl: 0,
      pnlPercent: 0,
      updatedAt: new Date(2026, 6, 8).toISOString(),
    });

    expect(getLocalBoard("2026-08")).toEqual([]);
    expect(getLocalBoard("2026-07")).toHaveLength(1);
  });
});

function entryFor(
  id: string,
  name: string,
  equity: number,
  month = "2026-08",
) {
  return {
    playerId: id,
    name,
    month,
    equity,
    cash: 0,
    invested: 0,
    pnl: 0,
    pnlPercent: 0,
    updatedAt: new Date(2026, 7, 8).toISOString(),
  };
}

describe("archiveLocalMonth", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("crowns the highest equity as the winner", () => {
    upsertLocalScore(entryFor("p1", "Low", 9_000, "2026-07"));
    upsertLocalScore(entryFor("p2", "High", 13_000, "2026-07"));

    expect(archiveLocalMonth("2026-07").winner?.name).toBe("High");
  });

  it("archives with no winner when the month had no players", () => {
    expect(archiveLocalMonth("2026-07").winner).toBeNull();
  });

  it("clears the live board so the new month starts empty", () => {
    upsertLocalScore(entryFor("p1", "Erick", 11_000, "2026-07"));
    archiveLocalMonth("2026-07");

    expect(getLocalBoard("2026-07")).toEqual([]);
  });

  it("makes the archive readable afterwards", () => {
    upsertLocalScore(entryFor("p1", "Erick", 11_000, "2026-07"));
    archiveLocalMonth("2026-07");

    expect(getLocalArchive("2026-07")?.winner?.name).toBe("Erick");
  });

  it("has no archive for a month never closed", () => {
    expect(getLocalArchive("2026-07")).toBeNull();
  });

  it("replaces an earlier archive of the same month", () => {
    upsertLocalScore(entryFor("p1", "First", 11_000, "2026-07"));
    archiveLocalMonth("2026-07");
    upsertLocalScore(entryFor("p2", "Second", 12_000, "2026-07"));
    archiveLocalMonth("2026-07");

    expect(getLocalArchive("2026-07")?.winner?.name).toBe("Second");
  });

  it("survives corrupt storage", () => {
    localStorage.setItem("erick-market.league.v1", "{ not json");
    expect(() => archiveLocalMonth("2026-07")).not.toThrow();
  });
});

describe("joinLeague", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    fetchMock.mockReset().mockResolvedValue({
      ok: true,
      json: async () => ({ playerId: "server-id" }),
    } as Response);
    vi.stubGlobal("fetch", fetchMock);
    // jsdom ships no SubtleCrypto; the hash only needs to be deterministic.
    vi.stubGlobal("crypto", {
      subtle: { digest: async () => new Uint8Array([1, 2, 3, 4]).buffer },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects a name that is too short", async () => {
    await expect(joinLeague("E", "1234")).rejects.toThrow(/at least 2/i);
  });

  it("rejects a PIN that is not 4 to 6 digits", async () => {
    await expect(joinLeague("Erick", "12")).rejects.toThrow(/PIN/);
    await expect(joinLeague("Erick", "1234567")).rejects.toThrow(/PIN/);
    await expect(joinLeague("Erick", "abcd")).rejects.toThrow(/PIN/);
  });

  it("trims and caps the name", async () => {
    const player = await joinLeague("   " + "n".repeat(40) + "   ", "1234");
    expect(player.name).toHaveLength(24);
  });

  it("never stores the raw PIN", async () => {
    const player = await joinLeague("Erick", "1234");

    expect(player.pinHash).not.toContain("1234");
    expect(JSON.stringify(localStorage)).not.toContain("1234");
  });

  it("adopts the server's id when the API answers", async () => {
    expect((await joinLeague("Erick", "1234")).id).toBe("server-id");
  });

  it("keeps the local id when the API is unreachable", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    const player = await joinLeague("Erick", "1234");

    expect(player.id).toBeTruthy();
    expect(player.id).not.toBe("server-id");
  });

  it("keeps the local id when the API rejects the join", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 } as Response);
    expect((await joinLeague("Erick", "1234")).id).not.toBe("server-id");
  });

  it("persists the player either way", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    await joinLeague("Erick", "1234");

    expect(loadPlayer()?.name).toBe("Erick");
  });
});

describe("submitLeagueScore and fetchLeagueBoard", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("records the score locally before going to the network", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));

    await submitLeagueScore({
      ...entryFor("p1", "Erick", 11_000),
      pinHash: "h",
    });

    expect(getLocalBoard("2026-08")[0].name).toBe("Erick");
  });

  it("does not throw when the API is down", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));

    await expect(
      submitLeagueScore({ ...entryFor("p1", "Erick", 1), pinHash: "h" }),
    ).resolves.toBeUndefined();
  });

  it("merges the shared board with local scores", async () => {
    upsertLocalScore(entryFor("local", "Local", 9_000));
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        mode: "shared",
        entries: [entryFor("remote", "Remote", 13_000)],
      }),
    } as Response);

    const board = await fetchLeagueBoard("2026-08");

    expect(board.mode).toBe("shared");
    expect(board.entries.map((e) => e.name)).toEqual(["Remote", "Local"]);
  });

  it("lets the shared board win for a player present in both", async () => {
    upsertLocalScore(entryFor("p1", "Stale", 1_000));
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        mode: "shared",
        entries: [entryFor("p1", "Fresh", 12_000)],
      }),
    } as Response);

    const board = await fetchLeagueBoard("2026-08");

    expect(board.entries).toHaveLength(1);
    expect(board.entries[0].name).toBe("Fresh");
  });

  it("treats an unrecognised mode as local", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ mode: "memory", entries: [] }),
    } as Response);

    expect((await fetchLeagueBoard("2026-08")).mode).toBe("local");
  });

  it("passes ephemeral mode through", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ mode: "ephemeral", entries: [] }),
    } as Response);

    expect((await fetchLeagueBoard("2026-08")).mode).toBe("ephemeral");
  });

  it("falls back to the local board when the API is unreachable", async () => {
    upsertLocalScore(entryFor("p1", "Erick", 11_000));
    fetchMock.mockRejectedValue(new Error("offline"));

    const board = await fetchLeagueBoard("2026-08");

    expect(board.mode).toBe("local");
    expect(board.entries[0].name).toBe("Erick");
  });

  it("falls back on a non-ok response", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503 } as Response);
    expect((await fetchLeagueBoard("2026-08")).mode).toBe("local");
  });

  it("prefers the server's previous winner", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        mode: "shared",
        entries: [],
        previousWinner: entryFor("p9", "Marta", 12_480),
      }),
    } as Response);

    expect((await fetchLeagueBoard("2026-08")).previousWinner?.name).toBe(
      "Marta",
    );
  });

  it("falls back to the locally archived winner", async () => {
    const prev = previousMonthKey();
    upsertLocalScore(entryFor("p1", "Erick", 11_000, prev));
    archiveLocalMonth(prev);
    fetchMock.mockRejectedValue(new Error("offline"));

    expect((await fetchLeagueBoard("2026-08")).previousWinner?.name).toBe(
      "Erick",
    );
  });
});
