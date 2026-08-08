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
    login,
  } = useUser();
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
      price: number;
      successMessage: string;
      failureMessage: string;
    }) => {
      if (!isAuthenticated) {
        dispatch({
          type: "SET_NOTICE",
          payload: { type: "info", message: "Sign in to trade." },
        });
        return;
      }
      const send = async (forceRefresh: boolean) => {
        const token = await getAccessToken({ forceRefresh });
        if (!token) throw new ApiError("No access token", 401, "token_missing");
        return postTrade(token, {
          side: input.side,
          symbol: input.symbol,
          company: input.company,
          qty: input.qty,
          price: input.price,
        });
      };

      try {
        let portfolio;
        try {
          portfolio = await send(false);
        } catch (err) {
          // A stale cached token is the common case after an idle hour. Renew
          // and retry once before bothering the user about it.
          if (!(err instanceof ApiError) || !err.isAuthFailure) throw err;
          portfolio = await send(true);
        }
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
      } catch (err) {
        // A dead session is not a trade error: say so plainly and send the
        // user where they can fix it, instead of surfacing the API's wording.
        if (err instanceof ApiError && err.isAuthFailure) {
          dispatch({
            type: "SET_NOTICE",
            payload: {
              type: "info",
              message: "Your session ended. Taking you to sign in…",
            },
          });
          login();
          return;
        }
        dispatch({
          type: "SET_NOTICE",
          payload: {
            type: "error",
            message: err instanceof Error ? err.message : input.failureMessage,
          },
        });
      }
    },
    [isAuthenticated, getAccessToken, refreshProfile, dispatch, login],
  );

  const buyStock = useCallback(
    async (stock: EnrichedStock, quantity: number) =>
      trade({
        side: "buy",
        symbol: symbolFromStock(stock),
        company: stock.company,
        qty: quantity,
        price: stock.price,
        successMessage: `Bought ${quantity} share(s) of ${stock.company}.`,
        failureMessage: "Buy failed",
      }),
    [trade],
  );

  const sellStock = useCallback(
    async (stockCompany: string, quantity: number, sellPrice: number) => {
      const held = state.portfolio.find((p) => p.company === stockCompany);
      return trade({
        side: "sell",
        symbol: held?.symbol || symbolFromCompany(stockCompany),
        company: stockCompany,
        qty: quantity,
        price: sellPrice,
        successMessage: `Sold ${quantity} share(s) of ${stockCompany}.`,
        failureMessage: "Sell failed",
      });
    },
    [trade, state.portfolio],
  );

  return { buyStock, sellStock, portfolioSynced };
}
