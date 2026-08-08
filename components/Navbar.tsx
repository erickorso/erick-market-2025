import React from "react";
import { Link } from "react-router-dom";
import { useStockContext } from "../context/StockContext";
import { useLeague } from "../context/LeagueContext";
import { useI18n } from "../context/I18nContext";

const Navbar: React.FC = () => {
  const { state, dispatch } = useStockContext();
  const { player } = useLeague();
  const { t, toggleLang, lang } = useI18n();

  return (
    <nav className="sticky top-0 z-50 bg-gray-800 p-4 shadow-lg">
      <div className="container mx-auto flex flex-col items-center justify-between sm:flex-row">
        <Link
          to="/"
          className="mb-2 text-2xl font-bold text-teal-400 transition duration-300 hover:text-teal-300 sm:mb-0"
        >
          Erick Stocks
        </Link>
        <div className="flex flex-col items-center space-y-2 sm:flex-row sm:space-x-4 sm:space-y-0">
          <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-0 sm:space-x-2">
            <Link
              data-testid="Home"
              to="/"
              className="rounded-md px-3 py-2 text-sm font-medium text-gray-300 transition duration-300 hover:text-white"
            >
              {t("navHome")}
            </Link>
            <Link
              data-testid="My_Stocks"
              to="/my-stocks"
              className="rounded-md px-3 py-2 text-sm font-medium text-gray-300 transition duration-300 hover:text-white"
            >
              {t("navStocks")}
            </Link>
            <Link
              data-testid="My_Fund"
              to="/my-fund"
              className="rounded-md px-3 py-2 text-sm font-medium text-gray-300 transition duration-300 hover:text-white"
            >
              {t("navFund")}
            </Link>
            <Link
              data-testid="League"
              to="/league"
              className="rounded-md px-3 py-2 text-sm font-medium text-teal-300 transition duration-300 hover:text-teal-200"
            >
              {t("navPlay")}
            </Link>
            {player && (
              <span className="hidden text-xs text-gray-500 sm:inline">
                {player.name}
              </span>
            )}
            <button
              type="button"
              onClick={toggleLang}
              className="rounded-md border border-gray-600 px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-300 hover:border-teal-500 hover:text-teal-300"
              aria-label={t("langAria")}
              title={lang === "en" ? "Español" : "English"}
            >
              {t("langToggle")}
            </button>
          </div>
          <input
            type="search"
            data-testid="search"
            placeholder={t("searchPlaceholder")}
            value={state.searchTerm}
            onChange={(e) =>
              dispatch({ type: "SET_SEARCH_TERM", payload: e.target.value })
            }
            aria-label={t("searchAria")}
            className="w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-gray-200 transition duration-300 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500 sm:w-auto"
          />
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
