import type { PortfolioItem } from "../types";
import { apiUrl } from "./apiBase";
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
  /** Blob URL of the profile photo, or null before one is taken. */
  avatar_url?: string | null;
};

const ME_URL = "/api/me";
const PORTFOLIO_URL = "/api/portfolio";
const TRADE_URL = "/api/trade";
const LEAGUE_URL = "/api/league";
const AVATAR_URL = "/api/avatar";

async function authFetch(
  url: string,
  token: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(apiUrl(url), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });
}

/** Error carrying the API's stable code, so callers can branch without regexes. */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }

  /** True when signing in again is the fix. */
  get isAuthFailure() {
    return (
      this.status === 401 ||
      this.code === "token_expired" ||
      this.code === "token_missing" ||
      this.code === "token_invalid"
    );
  }
}

/** Turns a failed response into an ApiError, whatever shape the body has. */
async function toApiError(res: Response, fallback: string): Promise<ApiError> {
  const body = (await res.json().catch(() => ({}))) as {
    error?: string;
    code?: string;
  };
  return new ApiError(
    body.error || `${fallback} ${res.status}`,
    res.status,
    body.code,
  );
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
    throw await toApiError(res, "me");
  }
  return (await res.json()) as { user: ApiUser; portfolio: ApiPortfolio };
}

export async function fetchPortfolio(token: string): Promise<ApiPortfolio> {
  const res = await authFetch(PORTFOLIO_URL, token);
  if (!res.ok) {
    throw await toApiError(res, "portfolio");
  }
  return (await res.json()) as ApiPortfolio;
}

export async function postTrade(
  token: string,
  // No price: the server looks it up. Letting the client name its own
  // execution price was a way to buy a million shares at a cent.
  body: {
    side: "buy" | "sell";
    symbol: string;
    company: string;
    qty: number;
  },
  /** One key per intention, reused by every replay of that same Buy. A new
   *  key per attempt would defeat the whole point. */
  idempotencyKey: string,
): Promise<ApiPortfolio> {
  const res = await authFetch(TRADE_URL, token, {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw await toApiError(res, "trade");
  }
  return (await res.json()) as ApiPortfolio;
}

export async function fetchLeagueBoard(month?: string) {
  const q = month ? `?month=${encodeURIComponent(month)}` : "";
  const res = await fetch(apiUrl(`${LEAGUE_URL}${q}`));
  if (!res.ok) {
    throw await toApiError(res, "league");
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
    throw await toApiError(res, "league score");
  }
  return (await res.json()) as {
    /** False when a holding had no live price, so the rank on screen is stale. */
    published: boolean;
    unpriced?: string[];
  };
}

/**
 * Uploads a profile photo and returns the updated user row.
 *
 * Raw bytes rather than multipart: there is exactly one field, and the
 * content type in the header carries everything the server needs to validate.
 */
export async function postAvatar(
  token: string,
  body: Blob | ArrayBuffer | Uint8Array,
  contentType: string,
): Promise<{ user: ApiUser }> {
  const res = await authFetch(AVATAR_URL, token, {
    method: "POST",
    headers: { "Content-Type": contentType },
    body: body as BodyInit,
  });
  if (!res.ok) {
    throw await toApiError(res, "avatar");
  }
  return (await res.json()) as { user: ApiUser };
}

export const emptyPortfolioState = {
  portfolio: [] as PortfolioItem[],
  fund: INITIAL_FUND_AMOUNT,
};
