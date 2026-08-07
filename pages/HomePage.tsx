import React, { Suspense } from "react";
import StockCard from "../components/StockCard";
import { useStockContext } from "../context/StockContext";

const ThreeDBackground = React.lazy(
  () => import("../components/ThreeDBackground"),
);

const HomePage: React.FC = () => {
  const { state, fetchStocks, loadMore } = useStockContext();
  const {
    allStocks,
    isLoading,
    isLoadingMore,
    error,
    searchTerm,
    dataSource,
    hasMore,
    total,
  } = state;

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div
          className="h-16 w-16 animate-spin rounded-full border-t-2 border-b-2 border-teal-500"
          role="status"
          aria-label="Loading stocks"
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
          <p className="mb-4 text-xl text-red-400">Error loading stocks: {error}</p>
          <button
            type="button"
            onClick={() => void fetchStocks()}
            className="rounded-lg bg-teal-500 px-4 py-2 font-semibold text-white hover:bg-teal-600"
          >
            Retry
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
            <h1 className="text-3xl font-bold text-teal-400 sm:text-4xl">
              Available Stocks
            </h1>
            <p className="mt-1 text-sm text-gray-400">
              Showing {allStocks.length}
              {total > 0 ? ` of ${total}` : ""}
              {searchTerm ? ` · “${searchTerm}”` : ""}
            </p>
          </div>
          {dataSource === "live" && (
            <span className="rounded-full bg-teal-500/20 px-3 py-1 text-xs font-medium text-teal-300">
              Finnhub · live · page 10
            </span>
          )}
          {dataSource === "mock" && (
            <span className="rounded-full bg-slate-500/20 px-3 py-1 text-xs font-medium text-slate-300">
              Mock data · page 10
            </span>
          )}
        </div>
        {allStocks.length === 0 ? (
          <div className="p-8 text-center text-xl text-gray-400">
            No stocks found matching your criteria.
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
                  {isLoadingMore ? "Loading…" : "Load more"}
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

