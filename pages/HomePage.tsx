import React from "react";
import CategoryFilter from "../components/organisms/CategoryFilter";
import StockGrid from "../components/organisms/StockGrid";
import StockGridSkeleton from "../components/organisms/StockGridSkeleton";
import MarketBackground from "../components/organisms/MarketBackground";
import Badge from "../components/atoms/Badge";
import { useStockContext } from "../context/StockContext";
import { useI18n } from "../context/I18nContext";
import type { MsgKey } from "../i18n/locales";
import { PAGE_SIZE } from "../data/watchlist";

const HomePage: React.FC = () => {
  const { state, fetchStocks, loadMore } = useStockContext();
  const { t } = useI18n();
  const {
    allStocks,
    isLoading,
    isLoadingMore,
    error,
    searchTerm,
    category,
    dataSource,
    hasMore,
    total,
  } = state;

  const catLabel =
    category === "all" ? "" : t(`cat_${category.replace(/-/g, "_")}` as MsgKey);

  if (error) {
    return (
      <>
        <MarketBackground />
        <div className="relative z-10 p-8 text-center">
          <p className="mb-4 text-xl text-red-600 dark:text-red-400">
            {t("errorLoading")} {error}
          </p>
          <button
            type="button"
            onClick={() => void fetchStocks()}
            className="rounded-lg bg-teal-700 px-4 py-2 font-semibold text-white hover:bg-teal-800"
          >
            {t("retry")}
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <MarketBackground />
      <div className="relative z-10 container mx-auto p-4 sm:p-6">
        <div className="mb-6 flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-teal-600 dark:text-teal-400 sm:text-4xl">
              {t("availableStocks")}
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-gray-400">
              {isLoading ? (
                t("loading")
              ) : (
                <>
                  {t("showing")} {allStocks.length}
                  {total > 0 ? ` ${t("of")} ${total}` : ""}
                </>
              )}
              {catLabel ? ` · ${catLabel}` : ""}
              {searchTerm ? ` · “${searchTerm}”` : ""}
            </p>
          </div>
          {dataSource === "live" && (
            <Badge variant="live" className="px-3 py-1 text-xs normal-case">
              {t("liveBadge", { size: PAGE_SIZE })}
            </Badge>
          )}
          {dataSource === "mock" && (
            <Badge variant="muted" className="px-3 py-1 text-xs normal-case">
              {t("mockBadge", { size: PAGE_SIZE })}
            </Badge>
          )}
        </div>

        <CategoryFilter />

        {isLoading ? (
          <StockGridSkeleton />
        ) : (
          <StockGrid
            stocks={allStocks}
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            onLoadMore={() => void loadMore()}
          />
        )}
      </div>
    </>
  );
};

export default HomePage;
