import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from "react";
import type { EnrichedStock, StockAction, StockContextState } from "../types";
import { initialState, stockReducer } from "./stockReducer";
import { readQueryFilters, useQueryFilters } from "../hooks/useQueryFilters";
import { useStockCatalog } from "../hooks/useStockCatalog";
import { useTrading } from "../hooks/useTrading";

const NOTICE_TIMEOUT_MS = 3500;

type StockContextValue = {
  state: StockContextState;
  dispatch: React.Dispatch<StockAction>;
  fetchStocks: () => Promise<void>;
  loadMore: () => Promise<void>;
  buyStock: (
    stock: EnrichedStock,
    quantity: number,
    idempotencyKey: string,
  ) => Promise<boolean>;
  sellStock: (
    stockCompany: string,
    quantity: number,
    idempotencyKey: string,
  ) => Promise<boolean>;
  portfolioSynced: boolean;
};

const StockContext = createContext<StockContextValue | null>(null);

/**
 * Composition root for the market screen. The behaviour lives in the hooks
 * below — this only wires them to the reducer and exposes the value.
 */
export const StockProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(stockReducer, null, () => {
    const { q, category } = readQueryFilters();
    return { ...initialState, searchTerm: q, category };
  });

  const { loadStocks, loadMore } = useStockCatalog(state, dispatch);
  const { buyStock, sellStock, portfolioSynced } = useTrading(state, dispatch);
  useQueryFilters(state.searchTerm, state.category);

  useEffect(() => {
    if (!state.notice) return;
    const id = window.setTimeout(() => {
      dispatch({ type: "CLEAR_NOTICE" });
    }, NOTICE_TIMEOUT_MS);
    return () => window.clearTimeout(id);
  }, [state.notice]);

  const value = useMemo(
    () => ({
      state,
      dispatch,
      fetchStocks: () => loadStocks(),
      loadMore,
      buyStock,
      sellStock,
      portfolioSynced,
    }),
    [state, loadStocks, loadMore, buyStock, sellStock, portfolioSynced],
  );

  return (
    <StockContext.Provider value={value}>{children}</StockContext.Provider>
  );
};

export const useStockContext = () => {
  const context = useContext(StockContext);
  if (!context) {
    throw new Error("useStockContext must be used within a StockProvider");
  }
  return context;
};

export type { EnrichedStock } from "../types";
