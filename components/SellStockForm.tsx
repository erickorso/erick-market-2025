import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStockContext } from '../context/StockContext';
import { UI } from '../constants';

const SellStockForm: React.FC = () => {
  const { stockCompany } = useParams<{ stockCompany: string }>(); // Changed from stockName
  const navigate = useNavigate();
  const { state, dispatch } = useStockContext();
  const [quantity, setQuantity] = useState<number>(1);
  const [error, setError] = useState<string>('');

  const decodedStockCompany = stockCompany ? decodeURIComponent(stockCompany) : ''; // Changed from decodedStockName

  const portfolioItem = state.portfolio.find(item => item.company === decodedStockCompany); // Changed from item.name
  const stockDetails = state.allStocks.find(s => s.company === decodedStockCompany); // Changed from s.name

  useEffect(() => {
    if (!portfolioItem || !stockDetails) {
      setError('Stock details not found. You might not own this stock or it is no longer listed.');
      // Optional: redirect if stock not found after a delay or immediately
      // navigate('/my-stocks');
    }
  }, [portfolioItem, stockDetails, navigate]);

  if (!portfolioItem || !stockDetails) {
    return (
      <div className="container mx-auto p-4 text-center">
        <h2 className="text-2xl font-bold text-red-500 mb-4">Error</h2>
        <p className="text-gray-300">{error || 'Loading stock details...'}</p>
        <button
          onClick={() => navigate('/my-stocks')}
          className="mt-4 bg-teal-500 hover:bg-teal-600 text-white font-semibold py-2 px-4 rounded-md transition duration-300"
        >
          Back to My Stocks
        </button>
      </div>
    );
  }

  const currentPrice = stockDetails.price;
  const maxQuantity = portfolioItem.quantity;

  const handleSell = () => {
    setError('');
    if (quantity <= 0) {
      setError("Quantity must be greater than zero.");
      return;
    }
    if (quantity > maxQuantity) {
      setError(`You can only sell up to ${maxQuantity} shares.`);
      return;
    }
    
    dispatch({
      type: "SELL_STOCK",
      payload: {
        stockCompany: decodedStockCompany,
        quantity,
        sellPrice: currentPrice,
      },
    });
    navigate("/my-stocks");
  };

  return (
    <div className="container mx-auto p-6 max-w-lg">
      <div data-testid="form" className="bg-gray-800 p-8 rounded-xl shadow-2xl">
        <h2 className="text-3xl font-bold text-teal-400 mb-6 text-center">Sell Stocks</h2>
        <div className="mb-4">
          <label className="block text-gray-400 text-sm font-bold mb-2">Company</label> {/* Changed from Company Name */}
          <input
            type="text"
            value={decodedStockCompany} // Changed from decodedStockName
            readOnly
            className="w-full bg-gray-700 text-gray-200 border border-gray-600 rounded py-2 px-3 leading-tight focus:outline-none"
          />
        </div>
        <div className="mb-4">
          <label className="block text-gray-400 text-sm font-bold mb-2" htmlFor="quantity">
            Quantity to Sell (Max: {maxQuantity})
          </label>
          <input
            type="number"
            id="quantity"
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
            min="1"
            max={maxQuantity}
            className="w-full bg-gray-700 text-gray-200 border border-gray-600 rounded py-2 px-3 leading-tight focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
        {error && <p className="text-red-500 text-xs italic mb-4">{error}</p>}
        <p className="text-gray-300 mb-1">Current Price: ₹{currentPrice.toFixed(2)} per share</p>
        <p className="text-gray-300 mb-6 font-semibold">Total Value: ₹{(currentPrice * quantity).toFixed(2)}</p>
        <div className="flex items-center justify-between">
          <button
            data-testid="sell"
            onClick={handleSell}
            className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-4 rounded-lg focus:outline-none focus:shadow-outline transition duration-300"
          >
            Confirm {UI.SELL_BUTTON}
          </button>
        </div>
         <button
            onClick={() => navigate('/my-stocks')}
            className="mt-4 w-full bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-4 rounded-md transition duration-300"
        >
            Cancel
        </button>
      </div>
    </div>
  );
};

export default SellStockForm;
