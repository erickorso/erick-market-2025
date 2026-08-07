import React, { useState } from 'react';
import { EnrichedStock, StockDisplayData } from '../types';
import { useStockContext } from '../context/StockContext';
import StockChart from './Chart';
import { UI } from '../constants';

interface StockCardProps {
  stock: EnrichedStock;
}

const StockCard: React.FC<StockCardProps> = ({ stock }) => {
  const { dispatch, state } = useStockContext();
  const [quantity, setQuantity] = useState<number>(1);

  const handleBuyStock = () => {
    dispatch({ type: "BUY_STOCK", payload: { stock, quantity } });
  };

  const incrementQuantity = () => setQuantity(prev => prev + 1);
  const decrementQuantity = () => setQuantity(prev => Math.max(1, prev - 1));

  const totalPrice = stock.price * quantity;
  const canAfford = state.fund >= totalPrice;

  const displayData: StockDisplayData = {
    company: stock.company,
    price: stock.price,
    chartData: stock.chartData,
  };

  return (
    <div data-testid="company-name" className="bg-gray-800 rounded-xl shadow-2xl p-6 hover:shadow-teal-500/30 transition-shadow duration-300 flex flex-col justify-between">
      <div>
        <h3 data-testid={stock.company} className="text-xl font-semibold text-teal-400 mb-2 truncate" title={stock.company}>
          {stock.company}
        </h3>
        <p className="text-2xl font-bold text-gray-100 mb-1">${stock.price.toFixed(2)}</p>
        {typeof stock.changePercent === "number" && (
          <p
            className={`mb-1 text-sm font-medium ${
              stock.changePercent >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {stock.changePercent >= 0 ? "+" : ""}
            {stock.changePercent.toFixed(2)}% today
          </p>
        )}
        {stock.tags && stock.tags.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1">
            {stock.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded border border-gray-600 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gray-400"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        <p className="text-xs text-gray-400 mb-3">Current Price</p>
        <div className="mb-4 h-48"> {/* Fixed height for chart area */}
            <StockChart data={displayData.chartData} lineColor="#2dd4bf" />
        </div>
      </div>
      
      <div className="mt-auto">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-gray-400">Quantity:</span>
          <div className="flex items-center">
            <button 
              data-testid="decrement" 
              onClick={decrementQuantity}
              aria-label={UI.DECREMENT_ARIA}
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-1 px-3 rounded-l transition duration-150"
            >
              -
            </button>
            <span data-testid="quantity" className="px-4 py-1 bg-gray-700 text-gray-100">{quantity}</span>
            <button 
              data-testid="increment" 
              onClick={incrementQuantity} 
              aria-label={UI.INCREMENT_ARIA}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-1 px-3 rounded-r transition duration-150"
            >
              +
            </button>
          </div>
        </div>
        <div data-testid="totalPrice" className="text-sm text-gray-300 mb-3">
          Total: ${totalPrice.toFixed(2)}
        </div>
        <button
          data-testid={`addCart-${stock.company}`} /* Changed from stock.name */
          onClick={handleBuyStock}
          disabled={!canAfford || quantity <= 0}
          className={`w-full font-semibold py-2 px-4 rounded-lg transition duration-300 text-sm
            ${canAfford && quantity > 0 ? 'bg-teal-500 hover:bg-teal-600 text-white' : 'bg-gray-600 text-gray-400 cursor-not-allowed'}`}
        >
          {UI.BUY_BUTTON} {canAfford ? '' : '(Insufficient Funds)'}
        </button>
      </div>
    </div>
  );
};

export default StockCard;
