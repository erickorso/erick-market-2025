import React from "react";
import { EnrichedStock } from "../types";
import { useStockContext } from "../context/StockContext";
import { useI18n } from "../context/I18nContext";
import { symbolFromStock } from "../services/symbols";
import StockChart from "./Chart";
import TradePanel from "./TradePanel";

interface StockCardProps {
  stock: EnrichedStock;
}

const StockCard: React.FC<StockCardProps> = ({ stock }) => {
  const { dispatch } = useStockContext();
  const { t } = useI18n();

  const symbol = symbolFromStock(stock);

  const openDetailModal = () => {
    dispatch({ type: "OPEN_DETAIL", payload: symbol });
  };

  return (
    <div
      data-testid="company-name"
      className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 shadow-lg transition-shadow duration-300 hover:shadow-teal-500/20 dark:border-transparent dark:bg-gray-800 dark:shadow-2xl dark:hover:shadow-teal-500/30"
    >
      <div>
        <button
          type="button"
          onClick={openDetailModal}
          className="mb-2 w-full text-left"
          aria-label={`${t("openDetail")} ${stock.company}`}
        >
          <h3
            data-testid={stock.company}
            className="truncate text-xl font-semibold text-teal-600 hover:text-teal-500 dark:text-teal-400 dark:hover:text-teal-300"
            title={stock.company}
          >
            {stock.company}
          </h3>
          <p className="text-2xl font-bold text-slate-900 dark:text-gray-100">
            ${stock.price.toFixed(2)}
          </p>
          {typeof stock.changePercent === "number" && (
            <p
              className={`text-sm font-medium ${
                stock.changePercent >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {stock.changePercent >= 0 ? "+" : ""}
              {stock.changePercent.toFixed(2)}
              {t("todayPct")}
            </p>
          )}
        </button>

        {stock.tags && stock.tags.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {stock.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded border border-gray-600 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gray-400"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <p className="mb-1 text-xs text-gray-500">
          {stock.chartSource === "yahoo" || stock.chartSource === "finnhub"
            ? t("chartLive")
            : t("chartSim")}
        </p>
        {stock.quoteSource === "simulated" && (
          <span className="mb-2 inline-flex rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
            {t("mockQuote")}
          </span>
        )}
        <button
          type="button"
          onClick={openDetailModal}
          className="mb-4 h-48 w-full text-left"
          aria-label={`${t("viewChartDetail")} ${symbol}`}
        >
          <StockChart data={stock.chartData} lineColor="#2dd4bf" height={180} />
        </button>
        <button
          type="button"
          onClick={openDetailModal}
          className="mb-4 text-xs font-medium text-teal-400 hover:text-teal-300"
        >
          {t("viewDetails")}
        </button>
      </div>

      <div className="mt-auto" onClick={(e) => e.stopPropagation()}>
        <TradePanel
          stock={stock}
          tipId={`buy-tip-${symbol}`}
          size="md"
          buyTestId={`addCart-${stock.company}`}
        />
      </div>
    </div>
  );
};

export default StockCard;
