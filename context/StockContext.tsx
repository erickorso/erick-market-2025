import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import {
  PortfolioItem,
  StockAction,
  StockContextState,
} from "../types";
import {
  INITIAL_FUND_AMOUNT,
  LIVE_POLL_MS,
  PRICE_TICK_MS,
  STORAGE_KEY,
} from "../constants";
import {
  fetchStocks,
  mergeLivePrices,
  tickStockPrices,
} from "../services/stockService";

const initialState: StockContextState = {
  allStocks: [],
  portfolio: [],
  fund: INITIAL_FUND_AMOUNT,
  isLoading: true,
  error: null,
  searchTerm: "",
  notice: null,
  dataSource: null,
};

function loadPersisted(): { portfolio: PortfolioItem[]; fund: number } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      portfolio?: PortfolioItem[];
      fund?: number;
    };
    if (!Array.isArray(parsed.portfolio) || typeof parsed.fund !== "number") {
      return null;
    }
    return { portfolio: parsed.portfolio, fund: parsed.fund };
  } catch {
    return null;
  }
}

function persist(portfolio: PortfolioItem[], fund: number) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ portfolio, fund }));
  } catch {
    /* ignore quota */
  }
}

const stockReducer = (
  state: StockContextState,
  action: StockAction,
): StockContextState => {
  switch (action.type) {
    case "SET_STOCKS":
      return {
        ...state,
        allStocks: action.payload,
        isLoading: false,
        error: null,
        dataSource: action.source,
      };
    case "MERGE_STOCKS":
      return {
        ...state,
        allStocks: action.payload,
        error: null,
      };
    case "SET_LOADING":
      return { ...state, isLoading: action.payload, error: null };
    case "SET_ERROR":
      return { ...state, error: action.payload, isLoading: false };
    case "SET_SEARCH_TERM":
      return { ...state, searchTerm: action.payload };
    case "SET_NOTICE":
      return { ...state, notice: action.payload };
    case "CLEAR_NOTICE":
      return { ...state, notice: null };
    case "HYDRATE_PORTFOLIO":
      return {
        ...state,
        portfolio: action.payload.portfolio,
        fund: action.payload.fund,
      };
    case "TICK_PRICES":
      return {
        ...state,
        allStocks: tickStockPrices(state.allStocks),
      };
    case "BUY_STOCK": {
      const { stock, quantity } = action.payload;
      if (quantity <= 0) {
        return {
          ...state,
          notice: { type: "error", message: "Enter a valid quantity." },
        };
      }
      const cost = stock.price * quantity;
      if (state.fund < cost) {
        return {
          ...state,
          notice: { type: "error", message: "Insufficient funds." },
        };
      }

      const existingItemIndex = state.portfolio.findIndex(
        (item) => item.stockId === stock.id,
      );
      let newPortfolio: PortfolioItem[];

      if (existingItemIndex > -1) {
        newPortfolio = state.portfolio.map((item, index) => {
          if (index !== existingItemIndex) return item;
          const newQuantity = item.quantity + quantity;
          const newTotalCost = item.totalCost + cost;
          return {
            ...item,
            quantity: newQuantity,
            purchasePrice: newTotalCost / newQuantity,
            totalCost: newTotalCost,
          };
        });
      } else {
        newPortfolio = [
          ...state.portfolio,
          {
            stockId: stock.id,
            company: stock.company,
            quantity,
            purchasePrice: stock.price,
            totalCost: cost,
          },
        ];
      }
      return {
        ...state,
        fund: state.fund - cost,
        portfolio: newPortfolio,
        notice: {
          type: "success",
          message: `Bought ${quantity} share(s) of ${stock.company}.`,
        },
      };
    }
    case "SELL_STOCK": {
      const { stockCompany, quantity, sellPrice } = action.payload;
      const itemIndex = state.portfolio.findIndex(
        (item) => item.company === stockCompany,
      );
      if (itemIndex === -1) {
        return {
          ...state,
          notice: { type: "error", message: "Stock not found in portfolio." },
        };
      }

      const itemToSell = state.portfolio[itemIndex];
      if (quantity <= 0) {
        return {
          ...state,
          notice: { type: "error", message: "Enter a valid quantity." },
        };
      }
      if (itemToSell.quantity < quantity) {
        return {
          ...state,
          notice: { type: "error", message: "Not enough shares to sell." },
        };
      }

      const earnings = sellPrice * quantity;
      const remainingQuantity = itemToSell.quantity - quantity;

      let newPortfolio: PortfolioItem[];
      if (remainingQuantity === 0) {
        newPortfolio = state.portfolio.filter((_, index) => index !== itemIndex);
      } else {
        const newTotalCost =
          (itemToSell.totalCost / itemToSell.quantity) * remainingQuantity;
        newPortfolio = state.portfolio.map((item, index) =>
          index === itemIndex
            ? {
                ...item,
                quantity: remainingQuantity,
                totalCost: newTotalCost,
                purchasePrice: newTotalCost / remainingQuantity,
              }
            : item,
        );
      }

      return {
        ...state,
        fund: state.fund + earnings,
        portfolio: newPortfolio,
        notice: {
          type: "success",
          message: `Sold ${quantity} share(s) of ${stockCompany}.`,
        },
      };
    }
    default:
      return state;
  }
};

type StockContextValue = {
  state: StockContextState;
  dispatch: React.Dispatch<StockAction>;
  fetchStocks: () => Promise<void>;
};

const StockContext = createContext<StockContextValue | null>(null);

export const StockProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(stockReducer, initialState);
  const hydrated = useRef(false);
  const stocksRef = useRef(state.allStocks);
  stocksRef.current = state.allStocks;

  const loadStocks = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) {
      dispatch({ type: "SET_LOADING", payload: true });
    }
    try {
      const { stocks, source } = await fetchStocks();
      if (opts?.silent) {
        dispatch({
          type: "MERGE_STOCKS",
          payload: mergeLivePrices(stocksRef.current, stocks),
        });
        return;
      }
      dispatch({ type: "SET_STOCKS", payload: stocks, source });
      if (source === "mock") {
        dispatch({
          type: "SET_NOTICE",
          payload: {
            type: "info",
            message:
              "Finnhub BFF offline — mock data. Set FINNHUB_API_KEY on Vercel.",
          },
        });
      } else {
        dispatch({
          type: "SET_NOTICE",
          payload: {
            type: "success",
            message: "Live market quotes (Finnhub).",
          },
        });
      }
    } catch (err) {
      if (!opts?.silent) {
        dispatch({
          type: "SET_ERROR",
          payload: err instanceof Error ? err.message : "Failed to fetch stocks",
        });
      }
    }
  }, []);

  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    const saved = loadPersisted();
    if (saved) {
      dispatch({ type: "HYDRATE_PORTFOLIO", payload: saved });
    }
    void loadStocks();
  }, [loadStocks]);

  useEffect(() => {
    if (state.isLoading) return;
    persist(state.portfolio, state.fund);
  }, [state.portfolio, state.fund, state.isLoading]);

  // Fake ticks only for mock/legacy
  useEffect(() => {
    if (state.isLoading || state.allStocks.length === 0) return;
    if (state.dataSource === "live") return;
    const id = window.setInterval(() => {
      dispatch({ type: "TICK_PRICES" });
    }, PRICE_TICK_MS);
    return () => window.clearInterval(id);
  }, [state.isLoading, state.allStocks.length, state.dataSource]);

  // Real poll when live
  useEffect(() => {
    if (state.isLoading || state.dataSource !== "live") return;
    const id = window.setInterval(() => {
      void loadStocks({ silent: true });
    }, LIVE_POLL_MS);
    return () => window.clearInterval(id);
  }, [state.isLoading, state.dataSource, loadStocks]);

  useEffect(() => {
    if (!state.notice) return;
    const id = window.setTimeout(() => {
      dispatch({ type: "CLEAR_NOTICE" });
    }, 3500);
    return () => window.clearTimeout(id);
  }, [state.notice]);

  const value = useMemo(
    () => ({ state, dispatch, fetchStocks: () => loadStocks() }),
    [state, loadStocks],
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
