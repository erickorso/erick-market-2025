import React from "react";
import StockListItem from "../components/molecules/StockListItem";
import { useStockContext } from "../context/StockContext";
import { useI18n } from "../context/I18nContext";

const MyStocksPage: React.FC = () => {
  const { state } = useStockContext();
  const { t } = useI18n();
  const { portfolio, allStocks } = state;

  const totalNetValue = portfolio.reduce((acc, item) => {
    const currentStock = allStocks.find((s) => s.id === item.stockId);
    const currentPrice = currentStock ? currentStock.price : item.purchasePrice;
    return acc + currentPrice * item.quantity;
  }, 0);

  if (portfolio.length === 0) {
    return (
      <div className="p-8 text-center text-xl text-slate-600 dark:text-gray-400">
        {t("noStocksOwned")}
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6">
      <h1 className="mb-8 text-center text-3xl font-bold text-teal-700 dark:text-teal-400 sm:text-4xl">
        {t("myPortfolio")}
      </h1>
      <div className="mb-8 rounded-xl bg-gray-800 p-6 shadow-2xl">
        <h2 className="text-2xl font-semibold text-gray-100">
          {t("portfolioSummary")}
        </h2>
        <p data-testid="totalPrice" className="mt-2 text-xl text-teal-700 dark:text-teal-400">
          {t("totalNet")} ${totalNetValue.toFixed(2)}
        </p>
      </div>
      <div className="space-y-6">
        {portfolio.map((item) => (
          <StockListItem key={item.stockId} item={item} />
        ))}
      </div>
    </div>
  );
};

export default MyStocksPage;
