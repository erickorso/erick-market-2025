import React, { useRef } from "react";
import { useI18n } from "../context/I18nContext";
import { useStockContext } from "../context/StockContext";
import { useWatchlist } from "../hooks/useWatchlist";
import { useWatchlistQuotes } from "../hooks/useWatchlistQuotes";
import { removeFromWatchlist } from "../services/localWatchlist";
import Badge from "../components/atoms/Badge";
import ChangePercent from "../components/atoms/ChangePercent";
import Price from "../components/atoms/Price";
import Skeleton from "../components/atoms/Skeleton";

/** "Apple Inc. (AAPL)" -> "Apple Inc."; nothing when the name is the ticker. */
function companyName(company: string | undefined, symbol: string) {
  const name = company?.replace(/\s*\([A-Z0-9.-]+\)$/, "").trim();
  return name && name !== symbol ? name : "";
}

/**
 * Symbols saved with the star on the grid or the detail modal, with their
 * live quote. The list itself lives in this browser's localStorage; a row
 * opens the same detail modal as the market grid.
 */
const WatchlistPage: React.FC = () => {
  const symbols = useWatchlist();
  const { quotes, loading } = useWatchlistQuotes(symbols);
  const { dispatch } = useStockContext();
  const { t } = useI18n();
  const headingRef = useRef<HTMLHeadingElement>(null);

  const remove = (symbol: string) => {
    removeFromWatchlist(symbol);
    // The focused button just left the DOM; keep keyboard users on the page.
    headingRef.current?.focus();
  };

  return (
    <div className="container mx-auto max-w-2xl p-4 sm:p-6">
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="mb-8 text-center text-3xl font-bold text-teal-700 outline-none dark:text-teal-400 sm:text-4xl"
      >
        {t("navWatchlist")}
      </h1>
      {symbols.length === 0 ? (
        <p className="p-8 text-center text-xl text-slate-600 dark:text-gray-400">
          {t("watchlistEmpty")}
        </p>
      ) : (
        <ul className="space-y-3">
          {symbols.map((symbol) => {
            const quote = quotes.get(symbol);
            const name = companyName(quote?.company, symbol);
            return (
              <li
                key={symbol}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white py-2 pl-2 pr-4 shadow dark:border-transparent dark:bg-gray-800"
              >
                <button
                  type="button"
                  onClick={() =>
                    dispatch({ type: "OPEN_DETAIL", payload: symbol })
                  }
                  className="flex min-w-0 flex-1 items-center justify-between gap-4 rounded-lg px-3 py-2 text-left hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:hover:bg-gray-700/50"
                >
                  <span className="min-w-0">
                    <span
                      data-testid="watchlist-symbol"
                      className="block text-lg font-semibold text-slate-900 dark:text-gray-100"
                    >
                      {symbol}
                    </span>
                    {name && (
                      <span className="block truncate text-xs text-slate-600 dark:text-gray-400">
                        {name}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-right">
                    {quote ? (
                      <>
                        <Price
                          value={quote.price}
                          className="block font-semibold text-slate-900 dark:text-gray-100"
                        />
                        {typeof quote.changePercent === "number" && (
                          <ChangePercent
                            value={quote.changePercent}
                            suffix={t("todayPct")}
                            className="block text-xs font-medium"
                          />
                        )}
                        {quote.quoteSource === "simulated" && (
                          <Badge variant="warning" size="xs" className="mt-1">
                            {t("mockQuote")}
                          </Badge>
                        )}
                      </>
                    ) : loading ? (
                      <Skeleton className="h-10 w-20" />
                    ) : (
                      <span className="text-slate-600 dark:text-gray-400">
                        —
                      </span>
                    )}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => remove(symbol)}
                  aria-label={t("watchlistRemoveAria", { symbol })}
                  className="shrink-0 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-rose-500 hover:text-rose-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:border-gray-600 dark:text-gray-300 dark:hover:border-rose-400 dark:hover:text-rose-300"
                >
                  {t("watchlistRemove")}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default WatchlistPage;
