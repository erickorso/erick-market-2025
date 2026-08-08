import type { PortfolioItem } from "../types";
import { INITIAL_FUND_AMOUNT } from "../constants";

export type ApiPortfolio = {
  month: string;
  cash: number;
  positions: {
    symbol: string;
    company: string;
    qty: number;
    avg_cost: number;
  }[];
};

export type ApiUser = {
  id: string;
  auth0_sub: string;
  email: string | null;
  display_name: string;
};

const ME_URL = "/api/me";
const PORTFOLIO_URL = "/api/portfolio";
const TRADE_URL = "/api/trade";
const LEAGUE_URL = "/api/league";

async function authFetch(
  url: string,
  token: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });
}

export function portfolioToState(p: ApiPortfolio): {
  portfolio: PortfolioItem[];
  fund: number;
  month: string;
} {
  return {
    month: p.month,
    fund: p.cash,
    portfolio: p.positions.map((pos) => ({
      stockId: pos.symbol.toLowerCase(),
      symbol: pos.symbol,
      company: pos.company.includes("(")
        ? pos.company
        : `${pos.company} (${pos.symbol})`,
      quantity: pos.qty,
      purchasePrice: pos.avg_cost,
      totalCost: pos.qty * pos.avg_cost,
    })),
  };
}

export async function fetchMe(token: string): Promise<{
  user: ApiUser;
  portfolio: ApiPortfolio;
}> {
  const res = await authFetch(ME_URL, token);
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || `me ${res.status}`);
  }
  return (await res.json()) as { user: ApiUser; portfolio: ApiPortfolio };
}

export async function fetchPortfolio(token: string): Promise<ApiPortfolio> {
  const res = await authFetch(PORTFOLIO_URL, token);
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || `portfolio ${res.status}`);
  }
  return (await res.json()) as ApiPortfolio;
}

export async function postTrade(
  token: string,
  body: {
    side: "buy" | "sell";
    symbol: string;
    company: string;
    qty: number;
    price: number;
  },
): Promise<ApiPortfolio> {
  const res = await authFetch(TRADE_URL, token, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || `trade ${res.status}`);
  }
  return (await res.json()) as ApiPortfolio;
}

export async function fetchLeagueBoard(month?: string) {
  const q = month ? `?month=${encodeURIComponent(month)}` : "";
  const res = await fetch(`${LEAGUE_URL}${q}`);
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || `league ${res.status}`);
  }
  return (await res.json()) as {
    mode: string;
    month: string;
    entries: {
      playerId: string;
      name: string;
      month: string;
      equity: number;
      cash: number;
      invested: number;
      pnl: number;
      pnlPercent: number;
      updatedAt: string;
    }[];
    previousWinner: {
      playerId: string;
      name: string;
      equity: number;
      pnlPercent: number;
    } | null;
  };
}

export async function postLeagueScore(
  token: string,
  body: {
    equity: number;
    cash: number;
    invested: number;
    pnl: number;
    pnlPercent: number;
  },
) {
  const res = await authFetch(LEAGUE_URL, token, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || `league score ${res.status}`);
  }
  return res.json();
}

export const emptyPortfolioState = {
  portfolio: [] as PortfolioItem[],
  fund: INITIAL_FUND_AMOUNT,
};
