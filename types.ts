export interface Stock {
  id: string;
  company: string;
  price: number;
}

export interface EnrichedStock extends Stock {
  chartData: ChartDataPoint[];
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
  error: string | null;
  searchTerm: string;
  notice: Notice;
  dataSource: "api" | "mock" | null;
}

export type StockAction =
  | { type: "SET_STOCKS"; payload: EnrichedStock[]; source: "api" | "mock" }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "BUY_STOCK"; payload: { stock: EnrichedStock; quantity: number } }
  | {
      type: "SELL_STOCK";
      payload: { stockCompany: string; quantity: number; sellPrice: number };
    }
  | { type: "SET_SEARCH_TERM"; payload: string }
  | { type: "SET_NOTICE"; payload: Notice }
  | { type: "CLEAR_NOTICE" }
  | { type: "HYDRATE_PORTFOLIO"; payload: { portfolio: PortfolioItem[]; fund: number } }
  | { type: "TICK_PRICES" };

export interface StockDisplayData {
  company: string;
  price: number;
  chartData: ChartDataPoint[];
}

/** Raw row from HackerEarth S3 JSON (uses `name`, not `company`). */
export type ApiStockRow = {
  name?: string;
  company?: string;
  price?: number | string;
};
