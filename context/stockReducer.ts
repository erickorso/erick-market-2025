import type {
  PortfolioItem,
  StockAction,
  StockContextState,
} from "../types";
import { INITIAL_FUND_AMOUNT } from "../constants";
import { tickStockPrices } from "../services/stockService";

export const initialState: StockContextState = {
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

/**
 * Pure state transitions for the market screen. Kept free of effects and
 * network calls so it can be exercised directly in unit tests.
 */
export const stockReducer = (
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
      return {
        ...state,
        error: action.payload,
        isLoading: false,
        isLoadingMore: false,
      };
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
