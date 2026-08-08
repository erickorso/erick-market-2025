import React from "react";
import { useNavigate } from "react-router-dom";
import { PortfolioItem } from "../../types";
import { useStockContext } from "../../context/StockContext";
import { useI18n } from "../../context/I18nContext";

interface StockListItemProps {
  item: PortfolioItem;
}

const StockListItem: React.FC<StockListItemProps> = ({ item }) => {
  const navigate = useNavigate();
  const { state } = useStockContext();
  const { t } = useI18n();

  const currentStockDetails = state.allStocks.find((s) => s.id === item.stockId);
  const currentPrice = currentStockDetails
    ? currentStockDetails.price
    : item.purchasePrice;
  const currentValue = currentPrice * item.quantity;
  const profitOrLoss = currentValue - item.totalCost;
  const profitOrLossPercent =
    item.totalCost > 0 ? (profitOrLoss / item.totalCost) * 100 : 0;

  const handleSellClick = () => {
    navigate(`/sell/${encodeURIComponent(item.company)}`);
  };

  return (
    <div
      data-testid="company-name"
      className="flex flex-col items-center justify-between space-y-3 rounded-lg bg-gray-800 p-4 shadow-md transition-shadow duration-200 hover:shadow-lg sm:flex-row sm:space-y-0"
    >
      <div className="flex-grow">
        <h4
          data-testid={item.company}
          className="text-lg font-semibold text-teal-700 dark:text-teal-400"
        >
          {item.company}
        </h4>
        <p className="text-sm text-slate-600 dark:text-gray-400">
          {t("quantity")}{" "}
          <span className="font-medium text-gray-200">{item.quantity}</span>
        </p>
        <p className="text-sm text-slate-600 dark:text-gray-400">
          {t("avgBuyPrice")}{" "}
          <span className="font-medium text-gray-200">
            ${item.purchasePrice.toFixed(2)}
          </span>
        </p>
        <p className="text-sm text-slate-600 dark:text-gray-400">
          {t("currentPrice")}{" "}
          <span className="font-medium text-gray-200">
            ${currentPrice.toFixed(2)}
          </span>
        </p>
        <p className="text-sm text-slate-600 dark:text-gray-400">
          {t("currentValue")}{" "}
          <span className="font-medium text-gray-200">
            ${currentValue.toFixed(2)}
          </span>
        </p>
        <p
          className={`text-sm ${
            profitOrLoss >= 0 ? "text-green-400" : "text-red-400"
          }`}
        >
          {t("pnl")} ${profitOrLoss.toFixed(2)} (
          {profitOrLossPercent.toFixed(2)}%)
        </p>
      </div>
      <button
        data-testid="sell"
        onClick={handleSellClick}
        className="w-full rounded-md bg-red-500 px-4 py-2 font-semibold text-white transition duration-300 hover:bg-red-600 sm:w-auto"
      >
        {t("sell")}
      </button>
    </div>
  );
};

export default StockListItem;
