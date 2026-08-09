import React, { useCallback, useEffect } from "react";
import type { EnrichedStock, StockAction, StockContextState } from "../types";
import { INITIAL_FUND_AMOUNT } from "../constants";
import {
  ApiError,
  portfolioToState,
  postTrade,
} from "../services/portfolioApi";
import { symbolFromCompany, symbolFromStock } from "../services/symbols";
import { useUser } from "../context/UserContext";
import { useI18n } from "../context/I18nContext";
import { useAuthPrompt } from "../context/AuthPromptContext";
import { withRetry } from "../services/retry";

/**
 * Owns the write side of the portfolio: hydrating it from the server and
 * posting trades. Local state is never the source of truth — every trade
 * replaces it with what the API returns.
 */
export function useTrading(
  state: StockContextState,
  dispatch: React.Dispatch<StockAction>,
) {
  const {
    isAuthenticated,
    getAccessToken,
    isLoading: authLoading,
    portfolio: serverPortfolio,
    refreshProfile,
  } = useUser();
  const { t } = useI18n();
  const { requestLogin } = useAuthPrompt();
  // Derived rather than stored: it is exactly "signed in and the server has
  // answered", so keeping it in state only created a second source of truth
  // that an effect had to keep in step.
  const portfolioSynced = Boolean(
    !authLoading && isAuthenticated && serverPortfolio,
  );

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      dispatch({
        type: "HYDRATE_PORTFOLIO",
        payload: { portfolio: [], fund: INITIAL_FUND_AMOUNT },
      });
      return;
    }
    if (!serverPortfolio) return;
    const mapped = portfolioToState(serverPortfolio);
    dispatch({
      type: "HYDRATE_PORTFOLIO",
      payload: { portfolio: mapped.portfolio, fund: mapped.fund },
    });
  }, [authLoading, isAuthenticated, serverPortfolio, dispatch]);

  const trade = useCallback(
    async (input: {
      side: "buy" | "sell";
      symbol: string;
      company: string;
      qty: number;
      idempotencyKey: string;
      successMessage: string;
      failureMessage: string;
    }): Promise<boolean> => {
      if (!isAuthenticated) {
        dispatch({
          type: "SET_NOTICE",
          payload: { type: "info", message: "Sign in to trade." },
        });
        return false;
      }

      const send = async (forceRefresh: boolean) => {
        const token = await getAccessToken({ forceRefresh });
        if (!token) throw new ApiError("No access token", 401, "token_missing");
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

      const attempt = async () => {
        try {
          return await send(false);
        } catch (err) {
          // A stale cached token is the common case after an idle hour. Renew
          // and retry once before bothering the user about it.
          if (!(err instanceof ApiError) || !err.isAuthFailure) throw err;
          return send(true);
        }
      };

      try {
        // Only `price_unavailable` is replayable: the server quotes before it
        // writes, so that error proves no trade was booked. A timeout proves
        // nothing, and replaying one could buy twice.
        const portfolio = await withRetry(
          attempt,
          (err) => err instanceof ApiError && err.code === "price_unavailable",
          {
            retries: 2,
            delayMs: 700,
            budgetMs: 8_000,
            onRetry: () =>
              dispatch({
                type: "SET_NOTICE",
                payload: { type: "info", message: t("tradeRetrying") },
              }),
          },
        );
        const mapped = portfolioToState(portfolio);
        dispatch({
          type: "HYDRATE_PORTFOLIO",
          payload: { portfolio: mapped.portfolio, fund: mapped.fund },
        });
        await refreshProfile();
        dispatch({
          type: "SET_NOTICE",
          payload: { type: "success", message: input.successMessage },
        });
        return true;
      } catch (err) {
        // A dead session is not a trade error: say so plainly and send the
        // user where they can fix it, instead of surfacing the API's wording.
        if (err instanceof ApiError && err.isAuthFailure) {
          dispatch({
            type: "SET_NOTICE",
            payload: { type: "info", message: t("sessionExpiredNotice") },
          });
          requestLogin("sessionExpired");
          return false;
        }
        // The quote feed, not the trade, is what failed. "No market price
        // available" is the API talking to itself; say what it means for the
        // person who just pressed Buy.
        if (err instanceof ApiError && err.code === "price_unavailable") {
          dispatch({
            type: "SET_NOTICE",
            payload: { type: "info", message: t("priceUnavailable") },
          });
          return false;
        }
        dispatch({
          type: "SET_NOTICE",
          payload: {
            type: "error",
            message: err instanceof Error ? err.message : input.failureMessage,
          },
        });
        return false;
      }
    },
    [
      isAuthenticated,
      getAccessToken,
      refreshProfile,
      dispatch,
      requestLogin,
      t,
    ],
  );

  const buyStock = useCallback(
    async (stock: EnrichedStock, quantity: number, idempotencyKey: string) =>
      trade({
        side: "buy",
        symbol: symbolFromStock(stock),
        company: stock.company,
        qty: quantity,
        idempotencyKey,
        successMessage: `Bought ${quantity} share(s) of ${stock.company}.`,
        failureMessage: "Buy failed",
      }),
    [trade],
  );

  const sellStock = useCallback(
    async (stockCompany: string, quantity: number, idempotencyKey: string) => {
      const held = state.portfolio.find((p) => p.company === stockCompany);
      return trade({
        side: "sell",
        symbol: held?.symbol || symbolFromCompany(stockCompany),
        company: stockCompany,
        qty: quantity,
        idempotencyKey,
        successMessage: `Sold ${quantity} share(s) of ${stockCompany}.`,
        failureMessage: "Sell failed",
      });
    },
    [trade, state.portfolio],
  );

  return { buyStock, sellStock, portfolioSynced };
}
