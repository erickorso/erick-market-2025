import { WATCHLIST } from "../server/watchlist";

const TRAILING_SYMBOL = /\(([A-Z.]+)\)\s*$/;

/**
 * Ticker for a catalog entry. Prefers the explicit field, then the
 * "Company (SYM)" suffix, then the generated id.
 */
export function symbolFromStock(stock: {
  symbol?: string;
  company: string;
  id: string;
}): string {
  if (stock.symbol) return stock.symbol.toUpperCase();
  const fromCompany = TRAILING_SYMBOL.exec(stock.company);
  if (fromCompany) return fromCompany[1];
  return stock.id.replace(/-\d+$/, "").toUpperCase();
}

/** Ticker for a portfolio row, which only carries the company label. */
export function symbolFromCompany(company: string): string {
  return TRAILING_SYMBOL.exec(company)?.[1] ?? company;
}

/**
 * Resolves the symbol a detail view was opened with against the loaded catalog,
 * falling back to the curated watchlist and finally to the raw input.
 */
export function resolveDetailSymbol(
  detailSymbol: string,
  catalog: { company: string; symbol?: string }[],
): string {
  const upper = detailSymbol.toUpperCase();
  const fromCatalog = catalog.find(
    (s) => s.symbol === upper || s.company.includes(`(${upper})`),
  );
  if (fromCatalog?.symbol) return fromCatalog.symbol;
  return WATCHLIST.find((w) => w.symbol === upper)?.symbol ?? upper;
}

/** Finds the catalog entry backing a symbol, matching either shape. */
export function findBySymbol<T extends { company: string; symbol?: string }>(
  catalog: T[],
  symbol: string,
): T | undefined {
  return catalog.find(
    (s) => s.symbol === symbol || s.company.includes(`(${symbol})`),
  );
}
