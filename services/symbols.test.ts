import { describe, expect, it } from "vitest";
import {
  findBySymbol,
  resolveDetailSymbol,
  symbolFromCompany,
  symbolFromStock,
} from "./symbols";

describe("symbolFromStock", () => {
  it("prefers the explicit field", () => {
    expect(
      symbolFromStock({ symbol: "aapl", company: "Apple (MSFT)", id: "x" }),
    ).toBe("AAPL");
  });

  it("falls back to the trailing ticker in the company label", () => {
    expect(symbolFromStock({ company: "Apple Inc. (AAPL)", id: "x" })).toBe(
      "AAPL",
    );
  });

  it("handles dotted tickers", () => {
    expect(symbolFromStock({ company: "Berkshire (BRK.B)", id: "x" })).toBe(
      "BRK.B",
    );
  });

  it("falls back to the id with its numeric suffix stripped", () => {
    expect(symbolFromStock({ company: "Mystery Co", id: "nvda-12" })).toBe(
      "NVDA",
    );
  });
});

describe("symbolFromCompany", () => {
  it("pulls the ticker out of a portfolio label", () => {
    expect(symbolFromCompany("Tesla (TSLA)")).toBe("TSLA");
  });

  it("returns the input when there is no ticker to find", () => {
    expect(symbolFromCompany("Tesla")).toBe("Tesla");
  });
});

describe("resolveDetailSymbol", () => {
  const catalog = [
    { company: "Apple Inc. (AAPL)", symbol: "AAPL" },
    { company: "Microsoft (MSFT)" },
  ];

  it("matches the catalog by symbol", () => {
    expect(resolveDetailSymbol("aapl", catalog)).toBe("AAPL");
  });

  it("falls back to the curated watchlist for known tickers", () => {
    expect(resolveDetailSymbol("nvda", [])).toBe("NVDA");
  });

  it("returns the upper-cased input for anything unknown", () => {
    expect(resolveDetailSymbol("zzzz", [])).toBe("ZZZZ");
  });
});

describe("findBySymbol", () => {
  const catalog = [
    { company: "Apple Inc. (AAPL)", symbol: "AAPL", price: 1 },
    { company: "Microsoft (MSFT)", price: 2 },
  ];

  it("matches on the symbol field", () => {
    expect(findBySymbol(catalog, "AAPL")?.price).toBe(1);
  });

  it("matches on the ticker embedded in the company label", () => {
    expect(findBySymbol(catalog, "MSFT")?.price).toBe(2);
  });

  it("returns undefined when nothing matches", () => {
    expect(findBySymbol(catalog, "TSLA")).toBeUndefined();
  });
});
