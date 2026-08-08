import React from "react";
import { CATEGORIES } from "../../services/stockService";
import { useStockContext } from "../../context/StockContext";
import { useI18n } from "../../context/I18nContext";
import type { CategoryId } from "../../types";
import type { MsgKey } from "../../i18n/locales";

function catKey(id: string): MsgKey {
  return `cat_${id.replace(/-/g, "_")}` as MsgKey;
}
function hintKey(id: string): MsgKey {
  return `hint_${id.replace(/-/g, "_")}` as MsgKey;
}

const CategoryFilter: React.FC = () => {
  const { state, dispatch } = useStockContext();
  const { t } = useI18n();
  const active = state.category;

  return (
    <div className="mb-6">
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label={t("categoriesAria")}
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
                  ? "border-teal-500 bg-teal-50 text-teal-700 dark:border-teal-400 dark:bg-teal-500/20 dark:text-teal-200"
                  : "border-slate-300 bg-white text-slate-600 hover:border-teal-500 hover:text-teal-700 dark:border-gray-600 dark:bg-gray-800/80 dark:text-gray-300 dark:hover:border-teal-600 dark:hover:text-teal-200"
              }`}
            >
              {t(catKey(cat.id))}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-gray-500">
        {t(hintKey(active))}. {t("eduLabels")}
      </p>
    </div>
  );
};

export default CategoryFilter;
