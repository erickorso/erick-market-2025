import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ApiError,
  fetchMe,
  postTrade,
  portfolioToState,
  type ApiPortfolio,
} from "../../services/portfolioApi";
import { newIdempotencyKey } from "../../services/idempotency";
import { withRetry } from "../../services/retry";
import { INITIAL_FUND_AMOUNT } from "../../constants";
import type { PortfolioItem } from "../../types";
import { useAuth } from "./auth";

type TradeResult = { ok: true } | { ok: false; message: string };

type PortfolioValue = {
  cash: number;
  positions: PortfolioItem[];
  displayName: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
  trade: (input: {
    side: "buy" | "sell";
    symbol: string;
    company: string;
    qty: number;
    idempotencyKey: string;
  }) => Promise<TradeResult>;
};

const PortfolioContext = createContext<PortfolioValue | null>(null);

/**
 * The write side, and the reason this app lives in the web repo: every rule
 * that makes a trade safe — server-quoted price, exactly-once via the
 * idempotency key, replay only on an error that proves nothing was written —
 * is enforced by code shared with the web, not reimplemented here.
 */
export const PortfolioProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isAuthenticated, getAccessToken } = useAuth();
  const [portfolio, setPortfolio] = useState<ApiPortfolio | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setPortfolio(null);
      setDisplayName(null);
      return;
    }
    setLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) return;
      const me = await fetchMe(token);
      setPortfolio(me.portfolio);
      setDisplayName(me.user.display_name);
    } catch {
      // A failed refresh leaves the last good numbers on screen rather than
      // blanking a portfolio the user was reading.
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, getAccessToken]);

  useEffect(() => {
    // Same shape as the web provider: the state it sets lands in a promise
    // callback, not synchronously in the render pass.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const trade = useCallback(
    async (input: {
      side: "buy" | "sell";
      symbol: string;
      company: string;
      qty: number;
      idempotencyKey: string;
    }): Promise<TradeResult> => {
      try {
        const send = async (forceRefresh: boolean) => {
          const token = await getAccessToken({ forceRefresh });
          if (!token) throw new ApiError("No token", 401, "token_missing");
          return postTrade(
            token,
            {
              side: input.side,
              symbol: input.symbol,
              company: input.company,
              qty: input.qty,
            },
            input.idempotencyKey,
          );
        };

        const next = await withRetry(
          async () => {
            try {
              return await send(false);
            } catch (err) {
              if (!(err instanceof ApiError) || !err.isAuthFailure) throw err;
              return send(true);
            }
          },
          // Same rule as the web: only the error that proves the server wrote
          // nothing may be replayed.
          (err) => err instanceof ApiError && err.code === "price_unavailable",
          { retries: 2, delayMs: 700, budgetMs: 8_000 },
        );

        setPortfolio(next);
        return { ok: true };
      } catch (err) {
        if (err instanceof ApiError && err.code === "price_unavailable") {
          return {
            ok: false,
            message: "No live price right now — nothing was traded.",
          };
        }
        if (err instanceof ApiError && err.isAuthFailure) {
          return { ok: false, message: "Your session ended. Sign in again." };
        }
        return {
          ok: false,
          message: err instanceof Error ? err.message : "Trade failed",
        };
      }
    },
    [getAccessToken],
  );

  const mapped = useMemo(
    () =>
      portfolio
        ? portfolioToState(portfolio)
        : { portfolio: [] as PortfolioItem[], fund: INITIAL_FUND_AMOUNT },
    [portfolio],
  );

  const value = useMemo<PortfolioValue>(
    () => ({
      cash: mapped.fund,
      positions: mapped.portfolio,
      displayName,
      loading,
      refresh,
      trade,
    }),
    [mapped, displayName, loading, refresh, trade],
  );

  return (
    <PortfolioContext.Provider value={value}>
      {children}
    </PortfolioContext.Provider>
  );
};

export const usePortfolio = () => {
  const ctx = useContext(PortfolioContext);
  if (!ctx)
    throw new Error("usePortfolio must be used within PortfolioProvider");
  return ctx;
};

export { newIdempotencyKey };
