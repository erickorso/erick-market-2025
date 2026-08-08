import { describe, expect, it } from "vitest";
import { initialState, stockReducer } from "./stockReducer";
import type { EnrichedStock, PortfolioItem, StockContextState } from "../types";

function stock(over: Partial<EnrichedStock> = {}): EnrichedStock {
  return {
    id: "aapl",
    company: "Apple (AAPL)",
    price: 100,
    chartData: [{ name: "T-1", price: 99 }],
    ...over,
  };
}

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

function state(over: Partial<StockContextState> = {}): StockContextState {
  return { ...initialState, ...over };
}

describe("catalog actions", () => {
  it("SET_STOCKS replaces the list and clears both loading flags", () => {
    const next = stockReducer(
      state({ isLoading: true, isLoadingMore: true, error: "boom" }),
      {
        type: "SET_STOCKS",
        payload: [stock()],
        source: "live",
        hasMore: true,
        total: 40,
      },
    );

    expect(next.allStocks).toHaveLength(1);
    expect(next.isLoading).toBe(false);
    expect(next.isLoadingMore).toBe(false);
    expect(next.error).toBeNull();
    expect(next.dataSource).toBe("live");
    expect(next.total).toBe(40);
  });

  it("APPEND_STOCKS drops ids already on screen", () => {
    const next = stockReducer(state({ allStocks: [stock({ id: "a" })] }), {
      type: "APPEND_STOCKS",
      payload: [stock({ id: "a" }), stock({ id: "b" })],
      hasMore: false,
      total: 2,
    });

    expect(next.allStocks.map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("MERGE_STOCKS swaps the list without touching loading state", () => {
    const before = state({
      isLoading: false,
      allStocks: [stock({ price: 1 })],
    });
    const next = stockReducer(before, {
      type: "MERGE_STOCKS",
      payload: [stock({ price: 2 })],
    });

    expect(next.allStocks[0].price).toBe(2);
    expect(next.isLoading).toBe(false);
  });

  it("SET_ERROR stops both spinners", () => {
    const next = stockReducer(state({ isLoading: true, isLoadingMore: true }), {
      type: "SET_ERROR",
      payload: "network down",
    });

    expect(next.error).toBe("network down");
    expect(next.isLoading).toBe(false);
    expect(next.isLoadingMore).toBe(false);
  });

  it("TICK_PRICES moves prices but keeps the same companies", () => {
    const next = stockReducer(
      state({ allStocks: [stock(), stock({ id: "b" })] }),
      {
        type: "TICK_PRICES",
      },
    );

    expect(next.allStocks).toHaveLength(2);
    expect(next.allStocks.map((s) => s.id)).toEqual(["aapl", "b"]);
    next.allStocks.forEach((s) => expect(s.price).toBeGreaterThan(0));
  });
});

describe("detail + notices", () => {
  it("OPEN_DETAIL normalises the symbol to upper case", () => {
    expect(
      stockReducer(state(), { type: "OPEN_DETAIL", payload: "msft" })
        .detailSymbol,
    ).toBe("MSFT");
  });

  it("CLOSE_DETAIL clears the open symbol", () => {
    expect(
      stockReducer(state({ detailSymbol: "MSFT" }), { type: "CLOSE_DETAIL" })
        .detailSymbol,
    ).toBeNull();
  });

  it("CLEAR_NOTICE removes the banner", () => {
    const next = stockReducer(
      state({ notice: { type: "success", message: "done" } }),
      { type: "CLEAR_NOTICE" },
    );
    expect(next.notice).toBeNull();
  });
});

describe("BUY_STOCK", () => {
  it("opens a new position and debits the fund", () => {
    const next = stockReducer(state({ fund: 1000 }), {
      type: "BUY_STOCK",
      payload: { stock: stock({ price: 100 }), quantity: 2 },
    });

    expect(next.fund).toBe(800);
    expect(next.portfolio).toEqual([
      {
        stockId: "aapl",
        company: "Apple (AAPL)",
        quantity: 2,
        purchasePrice: 100,
        totalCost: 200,
      },
    ]);
    expect(next.notice?.type).toBe("success");
  });

  it("averages the cost basis when adding to a position", () => {
    const next = stockReducer(
      state({
        fund: 1000,
        portfolio: [
          position({ quantity: 1, purchasePrice: 100, totalCost: 100 }),
        ],
      }),
      {
        type: "BUY_STOCK",
        payload: { stock: stock({ price: 200 }), quantity: 1 },
      },
    );

    expect(next.portfolio[0].quantity).toBe(2);
    expect(next.portfolio[0].totalCost).toBe(300);
    expect(next.portfolio[0].purchasePrice).toBe(150);
  });

  it("rejects a purchase the fund cannot cover", () => {
    const before = state({ fund: 50 });
    const next = stockReducer(before, {
      type: "BUY_STOCK",
      payload: { stock: stock({ price: 100 }), quantity: 1 },
    });

    expect(next.fund).toBe(50);
    expect(next.portfolio).toEqual([]);
    expect(next.notice).toEqual({
      type: "error",
      message: "Insufficient funds.",
    });
  });

  it("rejects a non-positive quantity", () => {
    const next = stockReducer(state({ fund: 1000 }), {
      type: "BUY_STOCK",
      payload: { stock: stock(), quantity: 0 },
    });

    expect(next.portfolio).toEqual([]);
    expect(next.notice?.type).toBe("error");
  });
});

describe("SELL_STOCK", () => {
  it("credits the proceeds and reduces the position", () => {
    const next = stockReducer(
      state({
        fund: 0,
        portfolio: [position({ quantity: 10, totalCost: 1000 })],
      }),
      {
        type: "SELL_STOCK",
        payload: {
          stockCompany: "Apple (AAPL)",
          quantity: 4,
          sellPrice: 150,
        },
      },
    );

    expect(next.fund).toBe(600);
    expect(next.portfolio[0].quantity).toBe(6);
    // Cost basis per share is preserved: 1000/10 * 6.
    expect(next.portfolio[0].totalCost).toBe(600);
    expect(next.portfolio[0].purchasePrice).toBe(100);
  });

  it("removes the position when the last share is sold", () => {
    const next = stockReducer(
      state({ portfolio: [position({ quantity: 3, totalCost: 300 })] }),
      {
        type: "SELL_STOCK",
        payload: { stockCompany: "Apple (AAPL)", quantity: 3, sellPrice: 100 },
      },
    );

    expect(next.portfolio).toEqual([]);
  });

  it("refuses to sell more shares than are held", () => {
    const before = state({ portfolio: [position({ quantity: 2 })] });
    const next = stockReducer(before, {
      type: "SELL_STOCK",
      payload: { stockCompany: "Apple (AAPL)", quantity: 5, sellPrice: 100 },
    });

    expect(next.portfolio[0].quantity).toBe(2);
    expect(next.notice).toEqual({
      type: "error",
      message: "Not enough shares to sell.",
    });
  });

  it("reports an unknown company instead of throwing", () => {
    const next = stockReducer(state(), {
      type: "SELL_STOCK",
      payload: { stockCompany: "Nope", quantity: 1, sellPrice: 1 },
    });

    expect(next.notice).toEqual({
      type: "error",
      message: "Stock not found in portfolio.",
    });
  });
});

describe("HYDRATE_PORTFOLIO", () => {
  it("takes the server as the source of truth", () => {
    const next = stockReducer(state({ fund: 1, portfolio: [position()] }), {
      type: "HYDRATE_PORTFOLIO",
      payload: { portfolio: [], fund: 10_000 },
    });

    expect(next.fund).toBe(10_000);
    expect(next.portfolio).toEqual([]);
  });
});
