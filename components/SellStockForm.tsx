import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useStockContext } from "../context/StockContext";
import { useI18n } from "../context/I18nContext";

const SellStockForm: React.FC = () => {
  const { stockCompany } = useParams<{ stockCompany: string }>();
  const navigate = useNavigate();
  const { state, dispatch } = useStockContext();
  const { t } = useI18n();
  const [quantity, setQuantity] = useState<number>(1);
  const [error, setError] = useState<string>("");

  const decodedStockCompany = stockCompany
    ? decodeURIComponent(stockCompany)
    : "";

  const portfolioItem = state.portfolio.find(
    (item) => item.company === decodedStockCompany,
  );
  const stockDetails = state.allStocks.find(
    (s) => s.company === decodedStockCompany,
  );

  useEffect(() => {
    if (!portfolioItem || !stockDetails) {
      setError(t("stockNotFound"));
    }
  }, [portfolioItem, stockDetails, t]);

  if (!portfolioItem || !stockDetails) {
    return (
      <div className="container mx-auto p-4 text-center">
        <h2 className="mb-4 text-2xl font-bold text-red-500">{t("error")}</h2>
        <p className="text-gray-300">{error || t("loadingStock")}</p>
        <button
          onClick={() => navigate("/my-stocks")}
          className="mt-4 rounded-md bg-teal-500 px-4 py-2 font-semibold text-white transition duration-300 hover:bg-teal-600"
        >
          {t("backToMyStocks")}
        </button>
      </div>
    );
  }

  const currentPrice = stockDetails.price;
  const maxQuantity = portfolioItem.quantity;

  const handleSell = () => {
    setError("");
    if (quantity <= 0) {
      setError(t("qtyMustBePositive"));
      return;
    }
    if (quantity > maxQuantity) {
      setError(t("canSellUpTo", { max: maxQuantity }));
      return;
    }

    dispatch({
      type: "SELL_STOCK",
      payload: {
        stockCompany: decodedStockCompany,
        quantity,
        sellPrice: currentPrice,
      },
    });
    navigate("/my-stocks");
  };

  return (
    <div className="container mx-auto max-w-lg p-6">
      <div data-testid="form" className="rounded-xl bg-gray-800 p-8 shadow-2xl">
        <h2 className="mb-6 text-center text-3xl font-bold text-teal-400">
          {t("sellStocks")}
        </h2>
        <div className="mb-4">
          <label className="mb-2 block text-sm font-bold text-gray-400">
            {t("company")}
          </label>
          <input
            type="text"
            value={decodedStockCompany}
            readOnly
            className="w-full rounded border border-gray-600 bg-gray-700 px-3 py-2 leading-tight text-gray-200 focus:outline-none"
          />
        </div>
        <div className="mb-4">
          <label
            className="mb-2 block text-sm font-bold text-gray-400"
            htmlFor="quantity"
          >
            {t("qtyToSell", { max: maxQuantity })}
          </label>
          <input
            type="number"
            id="quantity"
            value={quantity}
            onChange={(e) =>
              setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))
            }
            min="1"
            max={maxQuantity}
            className="w-full rounded border border-gray-600 bg-gray-700 px-3 py-2 leading-tight text-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
        {error && <p className="mb-4 text-xs italic text-red-500">{error}</p>}
        <p className="mb-1 text-gray-300">
          {t("currentPricePerShare", { price: currentPrice.toFixed(2) })}
        </p>
        <p className="mb-6 font-semibold text-gray-300">
          {t("totalValue")} ${(currentPrice * quantity).toFixed(2)}
        </p>
        <div className="flex items-center justify-between">
          <button
            data-testid="sell"
            onClick={handleSell}
            className="w-full rounded-lg bg-red-500 px-4 py-3 font-bold text-white transition duration-300 hover:bg-red-600 focus:outline-none focus:shadow-outline"
          >
            {t("confirmSell")}
          </button>
        </div>
        <button
          onClick={() => navigate("/my-stocks")}
          className="mt-4 w-full rounded-md bg-gray-600 px-4 py-2 font-semibold text-white transition duration-300 hover:bg-gray-500"
        >
          {t("cancel")}
        </button>
      </div>
    </div>
  );
};

export default SellStockForm;
