export interface Stock {
  id: string;
  company: string; // Changed from name
  price: number;
}

export interface EnrichedStock extends Stock {
  chartData: ChartDataPoint[];
}

export interface ChartDataPoint {
  name: string; // Typically date/time for x-axis
  price: number; // Price for y-axis
}

export interface PortfolioItem {
  stockId: string;
  company: string; // Changed from name
  quantity: number;
  purchasePrice: number; // Price at which this batch of stock was bought
  totalCost: number; // quantity * purchasePrice for this item
}

export interface StockContextState {
  allStocks: EnrichedStock[];
  portfolio: PortfolioItem[];
  fund: number;
  isLoading: boolean;
  error: string | null;
  searchTerm: string;
}

export type StockAction =
  | { type: 'SET_STOCKS'; payload: EnrichedStock[] }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'BUY_STOCK'; payload: { stock: EnrichedStock; quantity: number } }
  | { type: 'SELL_STOCK'; payload: { stockCompany: string; quantity: number; sellPrice: number } } // Changed from stockName
  | { type: 'SET_SEARCH_TERM'; payload: string };

export interface FundDetails {
  totalFund: number;
  totalInvestment: number;
  remainingFund: number;
}

// Props for components that need stock data (subset of EnrichedStock)
export interface StockDisplayData {
  company: string; // Changed from name
  price: number;
  chartData: ChartDataPoint[];
}
