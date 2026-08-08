import React, { useCallback, useEffect, useState } from "react";
import type { EnrichedStock, StockAction, StockContextState } from "../types";
import { INITIAL_FUND_AMOUNT } from "../constants";
import { portfolioToState, postTrade } from "../services/portfolioApi";
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
  } = useUser();
  const [portfolioSynced, setPortfolioSynced] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setPortfolioSynced(false);
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
    setPortfolioSynced(true);
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
      const token = await getAccessToken();
      if (!token) {
        dispatch({
          type: "SET_NOTICE",
          payload: { type: "error", message: "Auth token unavailable." },
        });
        return;
      }
      try {
        const portfolio = await postTrade(token, {
          side: input.side,
          symbol: input.symbol,
          company: input.company,
          qty: input.qty,
          price: input.price,
        });
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
        dispatch({
          type: "SET_NOTICE",
          payload: {
            type: "error",
            message: err instanceof Error ? err.message : input.failureMessage,
          },
        });
      }
    },
    [isAuthenticated, getAccessToken, refreshProfile, dispatch],
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
