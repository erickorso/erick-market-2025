import React, { useSyncExternalStore } from "react";
import { useI18n } from "../../context/I18nContext";
import {
  addToWatchlist,
  isInWatchlist,
  removeFromWatchlist,
  subscribeWatchlist,
} from "../../services/localWatchlist";

/**
 * Toggles a symbol in the local watchlist. A toggle button (aria-pressed) with
 * a fixed label, so assistive tech announces "Watch AAPL, pressed" rather than
 * a label that flips under the user's cursor.
 *
 * State lives in the watchlist module, not here, so every star for a symbol —
 * the grid card and the detail modal over it — shows the same thing.
 */
const WatchlistStar: React.FC<{ symbol: string }> = ({ symbol }) => {
  const { t } = useI18n();
  const watched = useSyncExternalStore(subscribeWatchlist, () =>
    isInWatchlist(symbol),
  );

  const toggle = () => {
    if (watched) removeFromWatchlist(symbol);
    else addToWatchlist(symbol);
  };

  const label = `${t("watchStar")} ${symbol}`;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={watched}
      aria-label={label}
      title={label}
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
        watched
          ? "text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
          : "text-slate-500 hover:text-amber-600 dark:text-gray-400 dark:hover:text-amber-400"
      }`}
    >
      <svg
        className="h-5 w-5"
        viewBox="0 0 24 24"
        fill={watched ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M12 2.5l2.94 5.96 6.56.95-4.75 4.63 1.12 6.54L12 17.5l-5.87 3.08 1.12-6.54L2.5 9.41l6.56-.95z" />
      </svg>
    </button>
  );
};

export default WatchlistStar;
