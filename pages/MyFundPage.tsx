import React from "react";
import { useStockContext } from "../context/StockContext";
import { useI18n } from "../context/I18nContext";
import { INITIAL_FUND_AMOUNT } from "../constants";
import { PortfolioItem } from "../types";

const MyFundPage: React.FC = () => {
  const { state } = useStockContext();
  const { t } = useI18n();
  const { fund: currentFund, portfolio } = state;

  const totalInvestment = portfolio.reduce(
    (acc, item: PortfolioItem) => acc + item.totalCost,
    0,
  );

  return (
    <div className="container mx-auto max-w-2xl p-4 sm:p-6">
      <h1 className="mb-8 text-center text-3xl font-bold text-teal-700 dark:text-teal-400 sm:text-4xl">
        {t("fundStatus")}
      </h1>
      <div className="space-y-6 rounded-xl bg-gray-800 p-8 shadow-2xl">
        <div>
          <h2 className="text-xl font-semibold text-gray-300">{t("initialFund")}</h2>
          <p className="text-3xl text-teal-300">${INITIAL_FUND_AMOUNT.toFixed(2)}</p>
        </div>
        <hr className="border-gray-700" />
        <div>
          <h2 className="text-xl font-semibold text-gray-300">
            {t("totalInvestment")}
          </h2>
          <p data-testid="stock-fund" className="text-3xl text-orange-400">
            ${totalInvestment.toFixed(2)}
          </p>
        </div>
        <hr className="border-gray-700" />
        <div>
          <h2 className="text-xl font-semibold text-gray-300">
            {t("remainingFund")}
          </h2>
          <p data-testid="fund" className="text-3xl text-green-400">
            ${currentFund.toFixed(2)}
          </p>
        </div>
      </div>

      {portfolio.length > 0 && (
        <div className="mt-8 rounded-xl bg-gray-800 p-6 shadow-xl">
          <h3 className="mb-4 text-2xl font-semibold text-teal-700 dark:text-teal-400">
            {t("investedStocks")}
          </h3>
          <ul className="space-y-3">
            {portfolio.map((item) => (
              <li
                key={item.stockId}
                className="flex items-center justify-between rounded-md bg-gray-700 p-3"
              >
                <span className="text-gray-200">
                  {item.company} ({t("qty")} {item.quantity})
                </span>
                <span className="font-medium text-gray-300">
                  {t("invested")} ${item.totalCost.toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default MyFundPage;
