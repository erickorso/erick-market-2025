import React from 'react';
import { Link } from 'react-router-dom';
import { useStockContext } from '../context/StockContext';
import { UI } from '../constants';
// Removed: import InteractiveNavTitle from './InteractiveNavTitle'; 

const Navbar: React.FC = () => {
  const { dispatch } = useStockContext();

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({ type: 'SET_SEARCH_TERM', payload: event.target.value });
  };

  return (
    <nav className="bg-gray-800 shadow-lg p-4 sticky top-0 z-50">
      <div className="container mx-auto flex flex-col sm:flex-row justify-between items-center">
        <Link 
          to="/" 
          className="text-2xl font-bold text-teal-400 hover:text-teal-300 transition duration-300 mb-2 sm:mb-0"
        >
          {UI.NAV_TITLE} {/* Reverted to static text */}
        </Link>
        <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-4">
          <div className="flex space-x-4">
            <Link data-testid="Home" to="/" className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition duration-300">
              {UI.HOME_LINK}
            </Link>
            <Link data-testid="My_Stocks" to="/my-stocks" className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition duration-300">
              {UI.MY_STOCKS_LINK}
            </Link>
            <Link data-testid="My_Fund" to="/my-fund" className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition duration-300">
              {UI.MY_FUND_LINK}
            </Link>
          </div>
          <input
            type="search"
            data-testid="search"
            placeholder={UI.SEARCH_PLACEHOLDER}
            onChange={handleSearchChange}
            className="px-3 py-2 bg-gray-700 text-gray-200 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition duration-300 w-full sm:w-auto"
          />
        </div>
      </div>
    </nav>
  );
};

export default Navbar;