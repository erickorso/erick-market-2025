import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PortfolioItem, EnrichedStock } from '../types';
import { useStockContext } from '../context/StockContext';
import { UI } from '../constants';

interface StockListItemProps {
  item: PortfolioItem;
}

const StockListItem: React.FC<StockListItemProps> = ({ item }) => {
  const navigate = useNavigate();
  const { state } = useStockContext();
  
  const currentStockDetails = state.allStocks.find(s => s.id === item.stockId);
  const currentPrice = currentStockDetails ? currentStockDetails.price : item.purchasePrice; // Fallback to purchase price if not found
  const currentValue = currentPrice * item.quantity;
  const profitOrLoss = currentValue - item.totalCost;
  const profitOrLossPercent = item.totalCost > 0 ? (profitOrLoss / item.totalCost) * 100 : 0;

  const handleSellClick = () => {
    navigate(`/sell/${encodeURIComponent(item.company)}`); // Changed from item.name
  };
  
  // console.log({ item }) // Item will now have 'company' instead of 'name'
  return (
    <div data-testid="company-name" className="bg-gray-800 p-4 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 flex flex-col sm:flex-row justify-between items-center space-y-3 sm:space-y-0">
      <div className="flex-grow">
        <h4 data-testid={item.company} className="text-lg font-semibold text-teal-400">{item.company}</h4> {/* Changed from item.name */}
        <p className="text-sm text-gray-400">Quantity: <span className="font-medium text-gray-200">{item.quantity}</span></p>
        <p className="text-sm text-gray-400">Avg. Buy Price: <span className="font-medium text-gray-200">₹{item.purchasePrice.toFixed(2)}</span></p>
        <p className="text-sm text-gray-400">Current Price: <span className="font-medium text-gray-200">₹{currentPrice.toFixed(2)}</span></p>
        <p className="text-sm text-gray-400">Current Value: <span className="font-medium text-gray-200">₹{currentValue.toFixed(2)}</span></p>
        <p className={`text-sm ${profitOrLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          P/L: ₹{profitOrLoss.toFixed(2)} ({profitOrLossPercent.toFixed(2)}%)
        </p>
      </div>
      <button
        data-testid="sell"
        onClick={handleSellClick}
        className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-md transition duration-300 w-full sm:w-auto"
      >
        {UI.SELL_BUTTON}
      </button>
    </div>
  );
};

export default StockListItem;
