import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useStockContext } from "../../context/StockContext";
import { useUser } from "../../context/UserContext";
import { useI18n } from "../../context/I18nContext";
import ThemeToggle from "../molecules/ThemeToggle";

const Navbar: React.FC = () => {
  const { state, dispatch } = useStockContext();
  const { isAuthenticated, displayName, login, logout, isLoading, auth } =
    useUser();
  const { t, toggleLang, lang } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="border-b border-slate-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:shadow-lg">
      <div className="container mx-auto flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full items-center gap-3 sm:w-auto">
          <ThemeToggle />
          <Link
            to="/"
            className="text-2xl font-bold text-teal-700 transition duration-300 hover:text-teal-500 dark:text-teal-400 dark:hover:text-teal-300"
          >
            Erick Stocks
          </Link>
        </div>
        <div className="flex flex-col items-center space-y-2 sm:flex-row sm:space-x-4 sm:space-y-0">
          <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-0 sm:space-x-2">
            <Link
              data-testid="Home"
              to="/"
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition duration-300 hover:text-slate-900 dark:text-gray-300 dark:hover:text-white"
            >
              {t("navHome")}
            </Link>
            {isAuthenticated && (
              <>
                <Link
                  data-testid="My_Stocks"
                  to="/my-stocks"
                  className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition duration-300 hover:text-slate-900 dark:text-gray-300 dark:hover:text-white"
                >
                  {t("navStocks")}
                </Link>
                <Link
                  data-testid="My_Fund"
                  to="/my-fund"
                  className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition duration-300 hover:text-slate-900 dark:text-gray-300 dark:hover:text-white"
                >
                  {t("navFund")}
                </Link>
              </>
            )}
            <Link
              data-testid="League"
              to="/league"
              className="rounded-md px-3 py-2 text-sm font-medium text-teal-700 transition duration-300 hover:text-teal-500 dark:text-teal-300 dark:hover:text-teal-200"
            >
              {t("navPlay")}
            </Link>
            {!isLoading && isAuthenticated && (
              <span className="hidden max-w-[8rem] truncate text-xs text-slate-600 dark:text-gray-400 sm:inline">
                {displayName || auth?.email}
              </span>
            )}
            {!isLoading && (
              <button
                type="button"
                onClick={isAuthenticated ? logout : login}
                className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-teal-500 hover:text-teal-700 dark:border-gray-600 dark:text-gray-300 dark:hover:border-teal-500 dark:hover:text-teal-300"
              >
                {isAuthenticated ? t("logout") : t("login")}
              </button>
            )}
            <button
              type="button"
              onClick={toggleLang}
              className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-700 hover:border-teal-500 hover:text-teal-700 dark:border-gray-600 dark:text-gray-300 dark:hover:border-teal-500 dark:hover:text-teal-300"
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
            onChange={(e) => {
              dispatch({ type: "SET_SEARCH_TERM", payload: e.target.value });
              // The results only exist on the catalog, so searching from
              // anywhere else takes you there rather than silently doing
              // nothing. Clearing the box does not yank you off the page.
              if (e.target.value.trim() && location.pathname !== "/") {
                navigate("/");
              }
            }}
            aria-label={t("searchAria")}
            className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-slate-800 transition duration-300 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 sm:w-auto"
          />
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
