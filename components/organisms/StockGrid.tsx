import React from "react";
import type { EnrichedStock } from "../../types";
import { useI18n } from "../../context/I18nContext";
import StockCard from "./StockCard";

/** The market grid plus its pagination control. */
const StockGrid: React.FC<{
  stocks: EnrichedStock[];
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
}> = ({ stocks, hasMore, isLoadingMore, onLoadMore }) => {
  const { t } = useI18n();

  if (stocks.length === 0) {
    return (
      <div className="p-8 text-center text-xl text-slate-600 dark:text-gray-400">
        {t("noStocks")}
      </div>
    );
  }

  return (
    <>
      {/* Columns follow the space the grid actually has, not the window width.
          Two sidebars sit beside it and the Top 10 one collapses, so viewport
          breakpoints were always guessing: 4 cards were forced into a squeezed
          centre column at 1280px, and collapsing a sidebar freed room the
          layout could not use. */}
      <div className="grid gap-6 [grid-template-columns:repeat(auto-fill,minmax(15rem,1fr))]">
        {stocks.map((stock) => (
          <StockCard key={stock.id} stock={stock} />
        ))}
      </div>
      {hasMore && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="rounded-lg bg-teal-700 px-6 py-2.5 font-semibold text-white hover:bg-teal-800 disabled:cursor-wait disabled:opacity-60"
            aria-busy={isLoadingMore}
          >
            {isLoadingMore ? t("loading") : t("loadMore")}
          </button>
        </div>
      )}
    </>
  );
};

export default StockGrid;
