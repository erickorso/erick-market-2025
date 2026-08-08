import React from "react";
import { useI18n } from "../../context/I18nContext";

type Size = "sm" | "md";

const sizes: Record<Size, { step: string; value: string }> = {
  md: {
    step: "px-3 py-1 font-bold",
    value: "bg-gray-700 px-4 py-1 text-gray-100",
  },
  sm: {
    step: "px-2 py-0.5 text-sm font-bold",
    value:
      "min-w-[2rem] bg-gray-700 px-2 py-0.5 text-center text-sm text-gray-100",
  },
};

/** Minus / value / plus control. Disabled for guests, who cannot trade. */
const QuantityStepper: React.FC<{
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
  disabled?: boolean;
  size?: Size;
}> = ({
  quantity,
  onIncrement,
  onDecrement,
  disabled = false,
  size = "md",
}) => {
  const { t } = useI18n();
  const s = sizes[size];

  return (
    <div className="flex items-center">
      <button
        data-testid="decrement"
        type="button"
        disabled={disabled}
        onClick={onDecrement}
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
        disabled={disabled}
        onClick={onIncrement}
        aria-label={t("incAria")}
        className={`rounded-r bg-green-600 text-white transition duration-150 hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40 ${s.step}`}
      >
        +
      </button>
    </div>
  );
};

export default QuantityStepper;
