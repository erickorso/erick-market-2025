import React from "react";
import { CATEGORIES } from "../services/stockService";
import { useStockContext } from "../context/StockContext";
import type { CategoryId } from "../types";

const CategoryFilter: React.FC = () => {
  const { state, dispatch } = useStockContext();
  const active = state.category;
  const hint =
    CATEGORIES.find((c) => c.id === active)?.hint ?? CATEGORIES[0].hint;

  return (
    <div className="mb-6">
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Stock categories"
      >
        {CATEGORIES.map((cat) => {
          const selected = cat.id === active;
          return (
            <button
              key={cat.id}
              type="button"
              aria-pressed={selected}
              onClick={() =>
                dispatch({
                  type: "SET_CATEGORY",
                  payload: cat.id as CategoryId,
                })
              }
              className={`rounded-md border px-3 py-1.5 text-sm font-medium transition ${
                selected
                  ? "border-teal-400 bg-teal-500/20 text-teal-200"
                  : "border-gray-600 bg-gray-800/80 text-gray-300 hover:border-teal-600 hover:text-teal-200"
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-gray-500">
        {hint}. Educational labels — not investment advice.
      </p>
    </div>
  );
};

export default CategoryFilter;
