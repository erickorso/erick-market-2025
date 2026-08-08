import React from "react";
import { EnrichedStock } from "../../types";
import { useStockContext } from "../../context/StockContext";
import { useI18n } from "../../context/I18nContext";
import { symbolFromStock } from "../../services/symbols";
import StockChart from "../atoms/Chart";
import Badge from "../atoms/Badge";
import Price from "../atoms/Price";
import ChangePercent from "../atoms/ChangePercent";
import TagList from "../molecules/TagList";
import TradePanel from "../molecules/TradePanel";
import ErrorBoundary from "./ErrorBoundary";

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
            className="truncate text-xl font-semibold text-teal-700 hover:text-teal-500 dark:text-teal-400 dark:hover:text-teal-300"
            title={stock.company}
          >
            {stock.company}
          </h3>
          <Price
            value={stock.price}
            className="block text-2xl font-bold text-slate-900 dark:text-gray-100"
          />
          {typeof stock.changePercent === "number" && (
            <ChangePercent
              value={stock.changePercent}
              suffix={t("todayPct")}
              className="block text-sm font-medium"
            />
          )}
        </button>

        {stock.tags && (
          <TagList tags={stock.tags} max={3} size="xs" className="mb-2 gap-1" />
        )}

        <p className="mb-1 text-xs text-slate-600 dark:text-gray-400">
          {stock.chartSource === "yahoo" || stock.chartSource === "finnhub"
            ? t("chartLive")
            : t("chartSim")}
        </p>
        {stock.quoteSource === "simulated" && (
          <Badge variant="warning" size="xs" className="mb-2">
            {t("mockQuote")}
          </Badge>
        )}
        <button
          type="button"
          onClick={openDetailModal}
          className="mb-4 h-48 w-full text-left"
          aria-label={`${t("viewChartDetail")} ${symbol}`}
        >
          <ErrorBoundary
            source="chart"
            fallback={
              <div className="flex h-full items-center justify-center rounded-lg bg-gray-800/80 text-xs text-slate-600 dark:text-gray-400">
                {t("chartUnavailable")}
              </div>
            }
          >
            <StockChart
              data={stock.chartData}
              lineColor="#2dd4bf"
              height={180}
            />
          </ErrorBoundary>
        </button>
        <button
          type="button"
          onClick={openDetailModal}
          className="mb-4 text-xs font-medium text-teal-700 dark:text-teal-400 hover:text-teal-300"
        >
          {t("viewDetails")}
        </button>
      </div>

      <div className="mt-auto">
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
