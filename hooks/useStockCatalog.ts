import React, { useCallback, useEffect, useRef } from "react";
import type { CategoryId, StockAction, StockContextState } from "../types";
import { LIVE_POLL_MS, PRICE_TICK_MS } from "../constants";
import {
  fetchStocks,
  mergeLivePrices,
  PAGE_SIZE,
} from "../services/stockService";

const SEARCH_DEBOUNCE_MS = 350;

type LoadOptions = { silent?: boolean; q?: string; category?: CategoryId };

/**
 * Owns everything about *getting* the catalog on screen: the initial load,
 * pagination, debounced search, category switches, and the two refresh loops
 * (simulated ticks when offline, silent polling when live).
 *
 * Callbacks read the current filters through refs so they stay referentially
 * stable — otherwise every poll would re-create them and restart the timers.
 */
export function useStockCatalog(
  state: StockContextState,
  dispatch: React.Dispatch<StockAction>,
) {
  const stocksRef = useRef(state.allStocks);
  const searchRef = useRef(state.searchTerm);
  const categoryRef = useRef(state.category);

  // Written in an effect, not during render: a ref mutated mid-render is not
  // safe under concurrent rendering, where a render can be thrown away. The
  // useRef initialisers above already hold the right values on first render,
  // and this effect is declared first so it runs before the ones that read it.
  useEffect(() => {
    stocksRef.current = state.allStocks;
    searchRef.current = state.searchTerm;
    categoryRef.current = state.category;
  }, [state.allStocks, state.searchTerm, state.category]);

  const loadStocks = useCallback(
    async (opts?: LoadOptions) => {
      const q = opts?.q ?? searchRef.current;
      const category = opts?.category ?? categoryRef.current;
      if (!opts?.silent) {
        dispatch({ type: "SET_LOADING", payload: true });
      }
      try {
        const limit = opts?.silent
          ? Math.max(PAGE_SIZE, stocksRef.current.length)
          : PAGE_SIZE;
        const result = await fetchStocks({ q, offset: 0, limit, category });
        if (opts?.silent) {
          dispatch({
            type: "MERGE_STOCKS",
            payload: mergeLivePrices(stocksRef.current, result.stocks),
          });
          return;
        }
        dispatch({
          type: "SET_STOCKS",
          payload: result.stocks,
          source: result.source,
          hasMore: result.hasMore,
          total: result.total,
        });
        dispatch({
          type: "SET_NOTICE",
          payload:
            result.source === "mock"
              ? {
                  type: "info",
                  message:
                    "Finnhub BFF offline — mock data. Set FINNHUB_API_KEY on Vercel.",
                }
              : { type: "success", message: "Live market quotes (Finnhub)." },
        });
      } catch (err) {
        if (!opts?.silent) {
          dispatch({
            type: "SET_ERROR",
            payload:
              err instanceof Error ? err.message : "Failed to fetch stocks",
          });
        }
      }
    },
    [dispatch],
  );

  const loadMore = useCallback(async () => {
    const loaded = stocksRef.current.length;
    if (!loaded) return;
    dispatch({ type: "SET_LOADING_MORE", payload: true });
    try {
      const result = await fetchStocks({
        q: searchRef.current,
        category: categoryRef.current,
        offset: loaded,
        limit: PAGE_SIZE,
      });
      dispatch({
        type: "APPEND_STOCKS",
        payload: result.stocks,
        hasMore: result.hasMore,
        total: result.total,
      });
    } catch {
      dispatch({ type: "SET_LOADING_MORE", payload: false });
    }
  }, [dispatch]);

  const booted = useRef(false);
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    void loadStocks({ q: searchRef.current, category: categoryRef.current });
  }, [loadStocks]);

  const searchBoot = useRef(true);
  useEffect(() => {
    if (searchBoot.current) {
      searchBoot.current = false;
      return;
    }
    const id = window.setTimeout(() => {
      void loadStocks({
        q: state.searchTerm,
        category: categoryRef.current,
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [state.searchTerm, loadStocks]);

  const categoryBoot = useRef(true);
  useEffect(() => {
    if (categoryBoot.current) {
      categoryBoot.current = false;
      return;
    }
    void loadStocks({ q: searchRef.current, category: state.category });
  }, [state.category, loadStocks]);

  // Offline / mock mode: nudge prices locally so the UI still feels alive.
  useEffect(() => {
    if (state.isLoading || state.allStocks.length === 0) return;
    if (state.dataSource === "live") return;
    const id = window.setInterval(() => {
      dispatch({ type: "TICK_PRICES" });
    }, PRICE_TICK_MS);
    return () => window.clearInterval(id);
  }, [state.isLoading, state.allStocks.length, state.dataSource, dispatch]);

  // Live mode: re-quote in the background and merge, never re-render as loading.
  useEffect(() => {
    if (state.isLoading || state.dataSource !== "live") return;
    const id = window.setInterval(() => {
      void loadStocks({ silent: true });
    }, LIVE_POLL_MS);
    return () => window.clearInterval(id);
  }, [state.isLoading, state.dataSource, loadStocks]);

  return { loadStocks, loadMore };
}
