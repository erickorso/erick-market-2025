import React from 'react';
import { useStockContext } from '../context/StockContext';
import { INITIAL_FUND_AMOUNT } from '../constants';
import { PortfolioItem } from '../types';

const MyFundPage: React.FC = () => {
  const { state } = useStockContext();
  const { fund: currentFund, portfolio } = state;

  const totalInvestment = portfolio.reduce((acc, item: PortfolioItem) => acc + item.totalCost, 0);

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-2xl">
      <h1 className="text-3xl sm:text-4xl font-bold text-center text-teal-400 mb-8">My Fund Status</h1>
      <div className="bg-gray-800 p-8 rounded-xl shadow-2xl space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-300">Initial Fund</h2>
          <p className="text-3xl text-teal-300">₹{INITIAL_FUND_AMOUNT.toFixed(2)}</p>
        </div>
        <hr className="border-gray-700"/>
        <div>
          <h2 className="text-xl font-semibold text-gray-300">Total Stock Investment</h2>
          <p data-testid="stock-fund" className="text-3xl text-orange-400">₹{totalInvestment.toFixed(2)}</p>
        </div>
        <hr className="border-gray-700"/>
        <div>
          <h2 className="text-xl font-semibold text-gray-300">Remaining Fund</h2>
          <p data-testid="fund" className="text-3xl text-green-400">₹{currentFund.toFixed(2)}</p>
        </div>
      </div>
      
      {portfolio.length > 0 && (
        <div className="mt-8 bg-gray-800 p-6 rounded-xl shadow-xl">
          <h3 className="text-2xl font-semibold text-teal-400 mb-4">Invested Stocks</h3>
          <ul className="space-y-3">
            {portfolio.map(item => (
              <li key={item.stockId} className="flex justify-between items-center p-3 bg-gray-700 rounded-md">
                <span className="text-gray-200">{item.company} (Qty: {item.quantity})</span> {/* Changed from item.name */}
                <span className="text-gray-300 font-medium">Invested: ₹{item.totalCost.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default MyFundPage;
