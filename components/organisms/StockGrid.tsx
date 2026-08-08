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
      <div className="p-8 text-center text-xl text-gray-400">
        {t("noStocks")}
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
            className="rounded-lg bg-teal-500 px-6 py-2.5 font-semibold text-white hover:bg-teal-600 disabled:cursor-wait disabled:opacity-60"
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
