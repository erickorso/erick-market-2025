
import React from 'react';
import StockListItem from '../components/StockListItem';
import { useStockContext } from '../context/StockContext';

const MyStocksPage: React.FC = () => {
  const { state } = useStockContext();
  const { portfolio, allStocks } = state;

  const totalNetValue = portfolio.reduce((acc, item) => {
    const currentStock = allStocks.find(s => s.id === item.stockId);
    const currentPrice = currentStock ? currentStock.price : item.purchasePrice; // Fallback strategy
    return acc + (currentPrice * item.quantity);
  }, 0);

  if (portfolio.length === 0) {
    return <div className="text-center text-gray-400 p-8 text-xl">You do not own any stocks yet.</div>;
  }

  return (
    <div className="container mx-auto p-4 sm:p-6">
      <h1 className="text-3xl sm:text-4xl font-bold text-center text-teal-400 mb-8">My Portfolio</h1>
      <div className="bg-gray-800 p-6 rounded-xl shadow-2xl mb-8">
        <h2 className="text-2xl font-semibold text-gray-100">Portfolio Summary</h2>
        <p data-testid="totalPrice" className="text-xl text-teal-400 mt-2">
          Total Net Value: ${totalNetValue.toFixed(2)}
        </p>
      </div>
      <div className="space-y-6">
        {portfolio.map(item => (
          <StockListItem key={item.stockId} item={item} />
        ))}
      </div>
    </div>
  );
};

export default MyStocksPage;
    