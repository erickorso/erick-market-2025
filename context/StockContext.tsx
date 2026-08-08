import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  CategoryId,
  EnrichedStock,
  PortfolioItem,
  StockAction,
  StockContextState,
} from "../types";
import {
  INITIAL_FUND_AMOUNT,
  LIVE_POLL_MS,
  PRICE_TICK_MS,
} from "../constants";
import {
  fetchStocks,
  mergeLivePrices,
  PAGE_SIZE,
  parseCategory,
  tickStockPrices,
} from "../services/stockService";
import {
  fetchMe,
  portfolioToState,
  postTrade,
} from "../services/portfolioApi";
import { useAuth } from "./AuthContext";

const initialState: StockContextState = {
  allStocks: [],
  portfolio: [],
  fund: INITIAL_FUND_AMOUNT,
  isLoading: true,
  isLoadingMore: false,
  error: null,
  searchTerm: "",
  category: "all",
  notice: null,
  dataSource: null,
  hasMore: false,
  total: 0,
  detailSymbol: null,
};

function readQueryFilters(): { q: string; category: CategoryId } {
  try {
    const sp = new URLSearchParams(window.location.search);
    return {
      q: sp.get("q")?.trim() ?? "",
      category: parseCategory(sp.get("category")),
    };
  } catch {
    return { q: "", category: "all" };
  }
}

function writeQueryFilters(q: string, category: CategoryId) {
  try {
    const url = new URL(window.location.href);
    if (q.trim()) url.searchParams.set("q", q.trim());
    else url.searchParams.delete("q");
    if (category && category !== "all") url.searchParams.set("category", category);
    else url.searchParams.delete("category");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  } catch {
    /* ignore */
  }
}

function extractSymbol(stock: { symbol?: string; company: string; id: string }) {
  if (stock.symbol) return stock.symbol.toUpperCase();
  const m = /\(([A-Z.]+)\)\s*$/.exec(stock.company);
  if (m) return m[1];
  return stock.id.replace(/-\d+$/, "").toUpperCase();
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
        isLoadingMore: false,
        error: null,
        dataSource: action.source,
        hasMore: action.hasMore,
        total: action.total,
      };
    case "APPEND_STOCKS": {
      const seen = new Set(state.allStocks.map((s) => s.id));
      const extra = action.payload.filter((s) => !seen.has(s.id));
      return {
        ...state,
        allStocks: [...state.allStocks, ...extra],
        isLoadingMore: false,
        hasMore: action.hasMore,
        total: action.total,
      };
    }
    case "MERGE_STOCKS":
      return {
        ...state,
        allStocks: action.payload,
        error: null,
      };
    case "SET_LOADING":
      return { ...state, isLoading: action.payload, error: null };
    case "SET_LOADING_MORE":
      return { ...state, isLoadingMore: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload, isLoading: false, isLoadingMore: false };
    case "SET_SEARCH_TERM":
      return { ...state, searchTerm: action.payload };
    case "SET_CATEGORY":
      return { ...state, category: action.payload };
    case "OPEN_DETAIL":
      return { ...state, detailSymbol: action.payload.toUpperCase() };
    case "CLOSE_DETAIL":
      return { ...state, detailSymbol: null };
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
  loadMore: () => Promise<void>;
  buyStock: (stock: EnrichedStock, quantity: number) => Promise<void>;
  sellStock: (
    stockCompany: string,
    quantity: number,
    sellPrice: number,
  ) => Promise<void>;
  portfolioSynced: boolean;
};

const StockContext = createContext<StockContextValue | null>(null);

export const StockProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isAuthenticated, getAccessToken, isLoading: authLoading } = useAuth();
  const [portfolioSynced, setPortfolioSynced] = useState(false);
  const [state, dispatch] = useReducer(stockReducer, null, () => {
    const { q, category } = readQueryFilters();
    return { ...initialState, searchTerm: q, category };
  });
  const hydrated = useRef(false);
  const stocksRef = useRef(state.allStocks);
  const searchRef = useRef(state.searchTerm);
  const categoryRef = useRef(state.category);
  stocksRef.current = state.allStocks;
  searchRef.current = state.searchTerm;
  categoryRef.current = state.category;

  const loadStocks = useCallback(
    async (opts?: { silent?: boolean; q?: string; category?: CategoryId }) => {
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
        if (result.source === "mock") {
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
            payload:
              err instanceof Error ? err.message : "Failed to fetch stocks",
          });
        }
      }
    },
    [],
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
  }, []);

  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    void loadStocks({
      q: searchRef.current,
      category: categoryRef.current,
    });
  }, [loadStocks]);

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
    let cancelled = false;
    void (async () => {
      try {
        const token = await getAccessToken();
        if (!token || cancelled) return;
        const { portfolio } = await fetchMe(token);
        if (cancelled) return;
        const mapped = portfolioToState(portfolio);
        dispatch({
          type: "HYDRATE_PORTFOLIO",
          payload: { portfolio: mapped.portfolio, fund: mapped.fund },
        });
        setPortfolioSynced(true);
      } catch (err) {
        if (cancelled) return;
        dispatch({
          type: "SET_NOTICE",
          payload: {
            type: "error",
            message:
              err instanceof Error
                ? err.message
                : "Could not load portfolio from server",
          },
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated, getAccessToken]);

  const buyStock = useCallback(
    async (stock: EnrichedStock, quantity: number) => {
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
        const symbol = extractSymbol(stock);
        const portfolio = await postTrade(token, {
          side: "buy",
          symbol,
          company: stock.company,
          qty: quantity,
          price: stock.price,
        });
        const mapped = portfolioToState(portfolio);
        dispatch({
          type: "HYDRATE_PORTFOLIO",
          payload: { portfolio: mapped.portfolio, fund: mapped.fund },
        });
        dispatch({
          type: "SET_NOTICE",
          payload: {
            type: "success",
            message: `Bought ${quantity} share(s) of ${stock.company}.`,
          },
        });
      } catch (err) {
        dispatch({
          type: "SET_NOTICE",
          payload: {
            type: "error",
            message: err instanceof Error ? err.message : "Buy failed",
          },
        });
      }
    },
    [isAuthenticated, getAccessToken],
  );

  const sellStock = useCallback(
    async (stockCompany: string, quantity: number, sellPrice: number) => {
      if (!isAuthenticated) {
        dispatch({
          type: "SET_NOTICE",
          payload: { type: "info", message: "Sign in to trade." },
        });
        return;
      }
      const token = await getAccessToken();
      if (!token) return;
      const item = state.portfolio.find((p) => p.company === stockCompany);
      const symbol =
        item?.symbol ||
        /\(([A-Z.]+)\)\s*$/.exec(stockCompany)?.[1] ||
        stockCompany;
      try {
        const portfolio = await postTrade(token, {
          side: "sell",
          symbol,
          company: stockCompany,
          qty: quantity,
          price: sellPrice,
        });
        const mapped = portfolioToState(portfolio);
        dispatch({
          type: "HYDRATE_PORTFOLIO",
          payload: { portfolio: mapped.portfolio, fund: mapped.fund },
        });
        dispatch({
          type: "SET_NOTICE",
          payload: {
            type: "success",
            message: `Sold ${quantity} share(s) of ${stockCompany}.`,
          },
        });
      } catch (err) {
        dispatch({
          type: "SET_NOTICE",
          payload: {
            type: "error",
            message: err instanceof Error ? err.message : "Sell failed",
          },
        });
      }
    },
    [isAuthenticated, getAccessToken, state.portfolio],
  );

  useEffect(() => {
    writeQueryFilters(state.searchTerm, state.category);
  }, [state.searchTerm, state.category]);

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
    }, 350);
    return () => window.clearTimeout(id);
  }, [state.searchTerm, loadStocks]);

  const categoryBoot = useRef(true);
  useEffect(() => {
    if (categoryBoot.current) {
      categoryBoot.current = false;
      return;
    }
    void loadStocks({
      q: searchRef.current,
      category: state.category,
    });
  }, [state.category, loadStocks]);

  useEffect(() => {
    if (state.isLoading || state.allStocks.length === 0) return;
    if (state.dataSource === "live") return;
    const id = window.setInterval(() => {
      dispatch({ type: "TICK_PRICES" });
    }, PRICE_TICK_MS);
    return () => window.clearInterval(id);
  }, [state.isLoading, state.allStocks.length, state.dataSource]);

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
