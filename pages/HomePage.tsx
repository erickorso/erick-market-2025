import React, { Suspense } from "react";
import StockCard from "../components/StockCard";
import CategoryFilter from "../components/CategoryFilter";
import { useStockContext } from "../context/StockContext";
import { useI18n } from "../context/I18nContext";
import type { MsgKey } from "../i18n/locales";

const ThreeDBackground = React.lazy(
  () => import("../components/ThreeDBackground"),
);

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
    category === "all"
      ? ""
      : t(`cat_${category.replace(/-/g, "_")}` as MsgKey);

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div
          className="h-16 w-16 animate-spin rounded-full border-t-2 border-b-2 border-teal-500"
          role="status"
          aria-label={t("loading")}
        />
      </div>
    );
  }

  if (error) {
    return (
      <>
        <Suspense fallback={null}>
          <ThreeDBackground />
        </Suspense>
        <div className="relative z-10 p-8 text-center">
          <p className="mb-4 text-xl text-red-400">
            {t("errorLoading")} {error}
          </p>
          <button
            type="button"
            onClick={() => void fetchStocks()}
            className="rounded-lg bg-teal-500 px-4 py-2 font-semibold text-white hover:bg-teal-600"
          >
            {t("retry")}
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <Suspense fallback={null}>
        <ThreeDBackground />
      </Suspense>
      <div className="relative z-10 container mx-auto p-4 sm:p-6">
        <div className="mb-6 flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-teal-600 dark:text-teal-400 sm:text-4xl">
              {t("availableStocks")}
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">
              {t("showing")} {allStocks.length}
              {total > 0 ? ` ${t("of")} ${total}` : ""}
              {catLabel ? ` · ${catLabel}` : ""}
              {searchTerm ? ` · “${searchTerm}”` : ""}
            </p>
          </div>
          {dataSource === "live" && (
            <span className="rounded-full bg-teal-500/20 px-3 py-1 text-xs font-medium text-teal-300">
              {t("liveBadge")}
            </span>
          )}
          {dataSource === "mock" && (
            <span className="rounded-full bg-slate-500/20 px-3 py-1 text-xs font-medium text-slate-300">
              {t("mockBadge")}
            </span>
          )}
        </div>

        <CategoryFilter />

        {allStocks.length === 0 ? (
          <div className="p-8 text-center text-xl text-gray-400">
            {t("noStocks")}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {allStocks.map((stock) => (
                <StockCard key={stock.id} stock={stock} />
              ))}
            </div>
            {hasMore && (
              <div className="mt-8 flex justify-center">
                <button
                  type="button"
                  onClick={() => void loadMore()}
                  disabled={isLoadingMore}
                  className="rounded-lg bg-teal-500 px-6 py-2.5 font-semibold text-white hover:bg-teal-600 disabled:cursor-wait disabled:opacity-60"
                  aria-busy={isLoadingMore}
                >
                  {isLoadingMore ? t("loading") : t("loadMore")}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default HomePage;
