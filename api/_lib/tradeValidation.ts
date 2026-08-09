/** Pure trade input validation — shared by API and unit tests. */

export type TradeSide = "buy" | "sell";

export type TradeInput = {
  side: TradeSide;
  symbol: string;
  company: string;
  qty: number;
};

/**
 * Deliberately has no `price`. The client used to send one and the server
 * booked it verbatim, so a hand-written request could buy a million shares at
 * a cent and take the league. The execution price is now looked up server
 * side, which leaves nothing about it for a caller to tamper with.
 */
export type ValidTrade = {
  side: TradeSide;
  symbol: string;
  company: string;
  qty: number;
};

function isFinitePositive(n: number): boolean {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

export function parseTradeInput(raw: {
  side?: unknown;
  symbol?: unknown;
  company?: unknown;
  qty?: unknown;
  price?: unknown;
}): ValidTrade {
  const side = raw.side === "buy" || raw.side === "sell" ? raw.side : null;
  if (!side) {
    throw Object.assign(new Error("side must be buy or sell"), { status: 400 });
  }

  const symbol =
    typeof raw.symbol === "string" ? raw.symbol.toUpperCase().trim() : "";
  if (!symbol || symbol.length > 16 || !/^[A-Z0-9.-]+$/.test(symbol)) {
    throw Object.assign(new Error("Invalid symbol"), { status: 400 });
  }

  const companyRaw =
    typeof raw.company === "string" && raw.company.trim()
      ? raw.company.trim()
      : symbol;
  const company = companyRaw.slice(0, 128);

  const qty = Number(raw.qty);
  if (!isFinitePositive(qty) || qty > 1_000_000) {
    throw Object.assign(new Error("Invalid quantity"), { status: 400 });
  }

  // A `price` in the body is ignored rather than rejected: an older client
  // still sends one, and failing those requests would be a worse outcome than
  // quietly pricing them correctly.
  return { side, symbol, company, qty };
}

export function computeEquityFromBooks(
  cash: number,
  positions: { qty: number; price: number }[],
  initialFund: number,
) {
  const invested = positions.reduce((sum, p) => sum + p.qty * p.price, 0);
  const equity = cash + invested;
  const pnl = equity - initialFund;
  const pnlPct = initialFund !== 0 ? (pnl / initialFund) * 100 : 0;
  return {
    cash,
    invested,
    equity,
    pnl,
    pnlPct,
  };
}
