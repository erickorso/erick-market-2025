import React from "react";
import { Link } from "react-router-dom";
import { useStockContext } from "../context/StockContext";
import { UI } from "../constants";

const Navbar: React.FC = () => {
  const { state, dispatch } = useStockContext();

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({ type: "SET_SEARCH_TERM", payload: event.target.value });
  };

  return (
    <nav className="sticky top-0 z-50 bg-gray-800 p-4 shadow-lg">
      <div className="container mx-auto flex flex-col items-center justify-between sm:flex-row">
        <Link
          to="/"
          className="mb-2 text-2xl font-bold text-teal-400 transition duration-300 hover:text-teal-300 sm:mb-0"
        >
          {UI.NAV_TITLE}
        </Link>
        <div className="flex flex-col items-center space-y-2 sm:flex-row sm:space-x-4 sm:space-y-0">
          <div className="flex space-x-4">
            <Link
              data-testid="Home"
              to="/"
              className="rounded-md px-3 py-2 text-sm font-medium text-gray-300 transition duration-300 hover:text-white"
            >
              {UI.HOME_LINK}
            </Link>
            <Link
              data-testid="My_Stocks"
              to="/my-stocks"
              className="rounded-md px-3 py-2 text-sm font-medium text-gray-300 transition duration-300 hover:text-white"
            >
              {UI.MY_STOCKS_LINK}
            </Link>
            <Link
              data-testid="My_Fund"
              to="/my-fund"
              className="rounded-md px-3 py-2 text-sm font-medium text-gray-300 transition duration-300 hover:text-white"
            >
              {UI.MY_FUND_LINK}
            </Link>
            <Link
              data-testid="League"
              to="/league"
              className="rounded-md px-3 py-2 text-sm font-medium text-gray-300 transition duration-300 hover:text-white"
            >
              {UI.LEAGUE_LINK}
            </Link>
          </div>
          <input
            type="search"
            data-testid="search"
            placeholder={UI.SEARCH_PLACEHOLDER}
            value={state.searchTerm}
            onChange={handleSearchChange}
            aria-label="Search stocks by symbol or company"
            className="w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-gray-200 transition duration-300 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500 sm:w-auto"
          />
        </div>
      </div>
    </nav>
  );
};

export default Navbar;

