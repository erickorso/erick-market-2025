import React from "react";
import type { EnrichedStock } from "../types";
import { useI18n } from "../context/I18nContext";
import { useTradePanel } from "../hooks/useTradePanel";
import ComicTooltip from "./ComicTooltip";

type Size = "sm" | "md";

type TradePanelProps = {
  stock: EnrichedStock | null;
  /** Ties the buy button to its tooltip via aria-describedby. */
  tipId: string;
  /** "md" for the card grid, "sm" for the detail modal footer. */
  size?: Size;
  /** Changing this resets the quantity — pass the open symbol in the modal. */
  resetKey?: string | null;
  tooltipAlign?: "center" | "right";
  /** Extra test ids, used by the e2e suite on the card variant. */
  buyTestId?: string;
  className?: string;
};

const styles: Record<
  Size,
  {
    root: string;
    row: string;
    label: string;
    step: string;
    value: string;
    total: string;
    button: string;
  }
> = {
  md: {
    root: "w-full",
    row: "mb-3 flex items-center justify-between",
    label: "text-sm text-gray-400",
    step: "px-3 py-1 font-bold",
    value: "bg-gray-700 px-4 py-1 text-gray-100",
    total: "mb-3 text-sm text-gray-300",
    button: "w-full rounded-lg px-4 py-2 text-sm font-semibold",
  },
  sm: {
    root: "flex w-fit max-w-[14rem] flex-col items-stretch gap-2",
    row: "flex items-center justify-end gap-2",
    label: "text-xs text-gray-400",
    step: "px-2 py-0.5 text-sm font-bold",
    value: "min-w-[2rem] bg-gray-700 px-2 py-0.5 text-center text-sm text-gray-100",
    total: "text-right text-xs text-gray-300",
    button: "w-full rounded-lg px-3 py-2 text-sm font-semibold",
  },
};

/**
 * Quantity stepper + total + buy button. The only place buy-side markup lives;
 * both the card and the detail modal render this with a different size.
 */
const TradePanel: React.FC<TradePanelProps> = ({
  stock,
  tipId,
  size = "md",
  resetKey,
  tooltipAlign = "center",
  buyTestId,
  className = "",
}) => {
  const { t } = useI18n();
  const s = styles[size];
  const {
    quantity,
    increment,
    decrement,
    totalPrice,
    canAfford,
    locked,
    disabled,
    submit,
  } = useTradePanel(stock, { resetKey });

  return (
    <div className={`${s.root} ${className}`}>
      <div className={s.row}>
        <span className={s.label}>{t("quantity")}</span>
        <div className="flex items-center">
          <button
            data-testid="decrement"
            type="button"
            disabled={locked}
            onClick={decrement}
            aria-label={t("decAria")}
            className={`rounded-l bg-red-600 text-white transition duration-150 hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40 ${s.step}`}
          >
            -
          </button>
          <span data-testid="quantity" className={s.value}>
            {quantity}
          </span>
          <button
            data-testid="increment"
            type="button"
            disabled={locked}
            onClick={increment}
            aria-label={t("incAria")}
            className={`rounded-r bg-green-600 text-white transition duration-150 hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40 ${s.step}`}
          >
            +
          </button>
        </div>
      </div>

      <p data-testid="totalPrice" className={s.total}>
        {t("total")} ${totalPrice.toFixed(2)}
      </p>

      <div className="group relative">
        <button
          data-testid={buyTestId}
          type="button"
          onClick={() => void submit()}
          disabled={disabled}
          aria-describedby={tipId}
          className={`transition duration-300 ${s.button} ${
            !locked && !disabled
              ? "bg-teal-500 text-white hover:bg-teal-600"
              : locked
                ? "cursor-pointer bg-gray-600 text-gray-200 hover:bg-gray-500"
                : "cursor-not-allowed bg-gray-600 text-gray-400"
          }`}
        >
          {t("buy")} {!locked && !canAfford ? t("insufficientFunds") : ""}
        </button>
        <ComicTooltip id={tipId} align={tooltipAlign}>
          {locked
            ? t("buyTooltipGuest")
            : !canAfford
              ? t("buyTooltipFunds")
              : t("buyTooltipOk")}
        </ComicTooltip>
      </div>
    </div>
  );
};

export default TradePanel;
