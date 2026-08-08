import React from "react";

/**
 * Signed change with the conventional green/red colouring. Callers pick the
 * precision and any suffix, since the market grid, the sidebars and the detail
 * header all render the same number differently.
 */
const ChangePercent: React.FC<{
  value: number;
  digits?: number;
  suffix?: string;
  className?: string;
}> = ({ value, digits = 2, suffix = "%", className = "" }) => (
  <span
    className={`${value >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"} ${className}`}
  >
    {value >= 0 ? "+" : ""}
    {value.toFixed(digits)}
    {suffix}
  </span>
);

export default ChangePercent;
