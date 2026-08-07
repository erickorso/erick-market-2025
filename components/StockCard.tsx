import React, { useState } from "react";
import { EnrichedStock } from "../types";
import { useStockContext } from "../context/StockContext";
import StockChart from "./Chart";
import { UI } from "../constants";

interface StockCardProps {
  stock: EnrichedStock;
}

const StockCard: React.FC<StockCardProps> = ({ stock }) => {
  const { dispatch, state } = useStockContext();
  const [quantity, setQuantity] = useState<number>(1);

  const symbol =
    stock.symbol ??
    (/\(([A-Z.]+)\)\s*$/.exec(stock.company)?.[1] ?? stock.id.toUpperCase());

  const openDetail = () => {
    dispatch({ type: "OPEN_DETAIL", payload: symbol });
  };

  const handleBuyStock = () => {
    dispatch({ type: "BUY_STOCK", payload: { stock, quantity } });
  };

  const totalPrice = stock.price * quantity;
  const canAfford = state.fund >= totalPrice;

  return (
    <div
      data-testid="company-name"
      className="flex flex-col justify-between rounded-xl bg-gray-800 p-6 shadow-2xl transition-shadow duration-300 hover:shadow-teal-500/30"
    >
      <div>
        <button
          type="button"
          onClick={openDetail}
          className="mb-2 w-full text-left"
          aria-label={`Open detail for ${stock.company}`}
        >
          <h3
            data-testid={stock.company}
            className="truncate text-xl font-semibold text-teal-400 hover:text-teal-300"
            title={stock.company}
          >
            {stock.company}
          </h3>
          <p className="text-2xl font-bold text-gray-100">${stock.price.toFixed(2)}</p>
          {typeof stock.changePercent === "number" && (
            <p
              className={`text-sm font-medium ${
                stock.changePercent >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {stock.changePercent >= 0 ? "+" : ""}
              {stock.changePercent.toFixed(2)}% today
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
          Sparkline · simulated (open detail for Finnhub candles)
        </p>
        <button
          type="button"
          onClick={openDetail}
          className="mb-4 h-48 w-full text-left"
          aria-label={`View chart detail for ${symbol}`}
        >
          <StockChart data={stock.chartData} lineColor="#2dd4bf" height={180} />
        </button>
        <button
          type="button"
          onClick={openDetail}
          className="mb-4 text-xs font-medium text-teal-400 hover:text-teal-300"
        >
          View details →
        </button>
      </div>

      <div className="mt-auto" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm text-gray-400">Quantity:</span>
          <div className="flex items-center">
            <button
              data-testid="decrement"
              type="button"
              onClick={() => setQuantity((p) => Math.max(1, p - 1))}
              aria-label={UI.DECREMENT_ARIA}
              className="rounded-l bg-red-600 px-3 py-1 font-bold text-white transition duration-150 hover:bg-red-700"
            >
              -
            </button>
            <span
              data-testid="quantity"
              className="bg-gray-700 px-4 py-1 text-gray-100"
            >
              {quantity}
            </span>
            <button
              data-testid="increment"
              type="button"
              onClick={() => setQuantity((p) => p + 1)}
              aria-label={UI.INCREMENT_ARIA}
              className="rounded-r bg-green-600 px-3 py-1 font-bold text-white transition duration-150 hover:bg-green-700"
            >
              +
            </button>
          </div>
        </div>
        <div data-testid="totalPrice" className="mb-3 text-sm text-gray-300">
          Total: ${totalPrice.toFixed(2)}
        </div>
        <button
          data-testid={`addCart-${stock.company}`}
          type="button"
          onClick={handleBuyStock}
          disabled={!canAfford || quantity <= 0}
          className={`w-full rounded-lg px-4 py-2 text-sm font-semibold transition duration-300 ${
            canAfford && quantity > 0
              ? "bg-teal-500 text-white hover:bg-teal-600"
              : "cursor-not-allowed bg-gray-600 text-gray-400"
          }`}
        >
          {UI.BUY_BUTTON} {canAfford ? "" : "(Insufficient Funds)"}
        </button>
      </div>
    </div>
  );
};

export default StockCard;
