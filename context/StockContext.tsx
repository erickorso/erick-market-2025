import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { Stock, EnrichedStock, PortfolioItem, StockContextState, StockAction, ChartDataPoint } from '../types';
import { INITIAL_FUND_AMOUNT, API_URL } from '../constants';

const initialState: StockContextState = {
  allStocks: [],
  portfolio: [],
  fund: INITIAL_FUND_AMOUNT,
  isLoading: true,
  error: null,
  searchTerm: '',
};

// Helper to generate simple chart data
const generateChartData = (currentPrice: number): ChartDataPoint[] => {
  const data: ChartDataPoint[] = [];
  const points = 10;
  for (let i = 0; i < points; i++) {
    const fluctuation = (Math.random() - 0.5) * currentPrice * 0.1; // Fluctuate by up to 10%
    data.push({
      name: `T-${points - 1 - i}`,
      price: Math.max(0, currentPrice - fluctuation * (points - 1 - i) * 0.2 + (Math.random() * currentPrice * 0.05)), // Simulating some trend + noise
    });
  }
  data.push({ name: 'Now', price: currentPrice });
  return data;
};


const stockReducer = (state: StockContextState, action: StockAction): StockContextState => {
  switch (action.type) {
    case 'SET_STOCKS':
      return { ...state, allStocks: action.payload, isLoading: false };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };
    case 'SET_SEARCH_TERM':
      return { ...state, searchTerm: action.payload };
    case 'BUY_STOCK': {
      const { stock, quantity } = action.payload;
      const cost = stock.price * quantity;
      if (state.fund < cost) {
        alert("Insufficient funds!"); // Or set an error state
        return state;
      }

      const existingItemIndex = state.portfolio.findIndex(item => item.stockId === stock.id);
      let newPortfolio: PortfolioItem[];

      if (existingItemIndex > -1) {
        newPortfolio = state.portfolio.map((item, index) => {
          if (index === existingItemIndex) {
            const newQuantity = item.quantity + quantity;
            const newTotalCost = item.totalCost + cost;
            return {
              ...item,
              quantity: newQuantity,
              purchasePrice: newTotalCost / newQuantity, // Average purchase price
              totalCost: newTotalCost,
            };
          }
          return item;
        });
      } else {
        newPortfolio = [
          ...state.portfolio,
          { stockId: stock.id, company: stock.company, quantity, purchasePrice: stock.price, totalCost: cost }, // Changed name to company
        ];
      }
      return {
        ...state,
        fund: state.fund - cost,
        portfolio: newPortfolio,
      };
    }
    case 'SELL_STOCK': {
      const { stockCompany, quantity, sellPrice } = action.payload; // Changed stockName to stockCompany
      const itemIndex = state.portfolio.findIndex(item => item.company === stockCompany); // Changed item.name to item.company
      if (itemIndex === -1) return state; // Should not happen if UI is correct

      const itemToSell = state.portfolio[itemIndex];
      if (itemToSell.quantity < quantity) {
         alert("Not enough stocks to sell!");
         return state;
      }

      const earnings = sellPrice * quantity;
      const remainingQuantity = itemToSell.quantity - quantity;
      
      let newPortfolio: PortfolioItem[];
      if (remainingQuantity === 0) {
        newPortfolio = state.portfolio.filter((_, index) => index !== itemIndex);
      } else {
        // Adjust total cost proportionally. (original_total_cost / original_quantity) * new_quantity
        const newTotalCost = (itemToSell.totalCost / itemToSell.quantity) * remainingQuantity;
        newPortfolio = state.portfolio.map((item, index) =>
          index === itemIndex ? { ...item, quantity: remainingQuantity, totalCost: newTotalCost, purchasePrice: newTotalCost / remainingQuantity } : item
        );
      }

      return {
        ...state,
        fund: state.fund + earnings,
        portfolio: newPortfolio,
      };
    }
    default:
      return state;
  }
};

const StockContext = createContext<{
  state: StockContextState;
  dispatch: React.Dispatch<StockAction>;
  fetchStocks: () => void;
}>({
  state: initialState,
  dispatch: () => null,
  fetchStocks: () => null,
});

export const StockProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(stockReducer, initialState);

  const fetchStocks = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const response = await fetch(API_URL);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      // Assume API returns objects with a 'company' field instead of 'name'
      // The API response type needs to be { company: string, price: number, ... }[] or { stocks: { company: string, ... }[] }
      const responseData: unknown = await response.json();
      let rawStocks: Partial<Stock>[]; // Use Partial<Stock> as items might be incomplete

      if (responseData && typeof responseData === 'object' && 'stocks' in responseData && Array.isArray((responseData as { stocks: unknown }).stocks)) {
        rawStocks = (responseData as { stocks: Partial<Stock>[] }).stocks;
      } else if (Array.isArray(responseData)) {
        rawStocks = responseData as Partial<Stock>[];
      } else {
        console.error("Invalid data structure from API:", responseData);
        throw new Error('Invalid data structure received from API.');
      }
      
      if (!rawStocks || rawStocks.length === 0) {
        dispatch({ type: 'SET_STOCKS', payload: [] });
        return;
      }

      const enrichedStocks: EnrichedStock[] = rawStocks.map((stock, index) => {
        if (!stock || typeof stock !== 'object') {
          const fallbackCompany = `Invalid Stock Data ${index}`;
          console.warn(`Invalid stock item at index ${index}:`, stock, `. Using fallback: ${fallbackCompany}`);
          return {
            id: fallbackCompany.replace(/\s+/g, '-').toLowerCase() + `-${index}`,
            company: fallbackCompany, // Changed from name
            price: 0,
            chartData: generateChartData(0),
          } as EnrichedStock;
        }

        const stockCompany = (typeof stock.company === 'string' && stock.company.trim() !== '') 
                              ? stock.company.trim() 
                              : `Unknown Company ${index}`; // Changed from "Unknown Stock"
        
        const price = typeof stock.price === 'number' && !isNaN(stock.price) ? stock.price : 0;

        if (stockCompany === `Unknown Company ${index}` && (typeof stock.company !== 'string' || !stock.company || stock.company.trim() === '')) {
          console.warn(`Stock at index ${index} has missing or invalid company. Original company: '${stock.company}'. Assigned fallback: "${stockCompany}". Original price: '${stock.price}'. Using price: ${price}.`);
        }
        
        return {
          ...(stock as Stock), 
          company: stockCompany,    
          price: price,       
          id: stockCompany.replace(/\s+/g, '-').toLowerCase() + `-${index}`, // Generate ID using company
          chartData: generateChartData(price),
        };
      });
      dispatch({ type: 'SET_STOCKS', payload: enrichedStocks });
    } catch (err) {
      console.error("Failed to fetch stocks:", err);
      dispatch({ type: 'SET_ERROR', payload: (err as Error).message || 'Failed to fetch stocks' });
    }
  }, []);

  useEffect(() => {
    fetchStocks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  return (
    <StockContext.Provider value={{ state, dispatch, fetchStocks }}>
      {children}
    </StockContext.Provider>
  );
};

export const useStockContext = () => {
  const context = useContext(StockContext);
  if (context === undefined) {
    throw new Error('useStockContext must be used within a StockProvider');
  }
  return context;
};
