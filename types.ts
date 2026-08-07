export type StyleTag =
  | "long-term"
  | "short-term"
  | "growth"
  | "dividend"
  | "blue-chip"
  | "volatile";

export type CategoryId = "all" | StyleTag | "gainers" | "losers";

export interface Stock {
  id: string;
  company: string;
  price: number;
}

export interface EnrichedStock extends Stock {
  chartData: ChartDataPoint[];
  /** Simulated sparkline on cards — not Finnhub candles. */
  chartSource?: "simulated" | "live";
  symbol?: string;
  tags?: StyleTag[];
  change?: number;
  changePercent?: number;
}

export interface ChartDataPoint {
  name: string;
  price: number;
}

export interface PortfolioItem {
  stockId: string;
  company: string;
  quantity: number;
  purchasePrice: number;
  totalCost: number;
}

export type Notice = {
  type: "success" | "error" | "info";
  message: string;
} | null;

export interface StockContextState {
  allStocks: EnrichedStock[];
  portfolio: PortfolioItem[];
  fund: number;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  searchTerm: string;
  category: CategoryId;
  notice: Notice;
  dataSource: "live" | "mock" | null;
  hasMore: boolean;
  total: number;
  detailSymbol: string | null;
}

export type StockAction =
  | {
      type: "SET_STOCKS";
      payload: EnrichedStock[];
      source: "live" | "mock";
      hasMore: boolean;
      total: number;
    }
  | {
      type: "APPEND_STOCKS";
      payload: EnrichedStock[];
      hasMore: boolean;
      total: number;
    }
  | { type: "MERGE_STOCKS"; payload: EnrichedStock[] }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_LOADING_MORE"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "BUY_STOCK"; payload: { stock: EnrichedStock; quantity: number } }
  | {
      type: "SELL_STOCK";
      payload: { stockCompany: string; quantity: number; sellPrice: number };
    }
  | { type: "SET_SEARCH_TERM"; payload: string }
  | { type: "SET_CATEGORY"; payload: CategoryId }
  | { type: "OPEN_DETAIL"; payload: string }
  | { type: "CLOSE_DETAIL" }
  | { type: "SET_NOTICE"; payload: Notice }
  | { type: "CLEAR_NOTICE" }
  | { type: "HYDRATE_PORTFOLIO"; payload: { portfolio: PortfolioItem[]; fund: number } }
  | { type: "TICK_PRICES" };

export interface StockDisplayData {
  company: string;
  price: number;
  chartData: ChartDataPoint[];
}

/** Raw row from BFF / legacy JSON. */
export type ApiStockRow = {
  name?: string;
  company?: string;
  symbol?: string;
  price?: number | string;
  change?: number;
  changePercent?: number;
  tags?: StyleTag[];
};
