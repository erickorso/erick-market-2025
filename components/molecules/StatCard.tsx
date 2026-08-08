import React from "react";

/** One boxed quote figure (open / high / low / previous close). */
const StatCard: React.FC<{ label: string; value: number | null }> = ({
  label,
  value,
}) => (
  <div className="rounded-md border border-gray-700 bg-gray-800/50 p-2.5">
    <dt className="text-[11px] uppercase tracking-wide text-slate-600 dark:text-gray-400">
      {label}
    </dt>
    <dd className="text-sm font-semibold text-gray-100">
      {typeof value === "number" ? `$${value.toFixed(2)}` : "—"}
    </dd>
  </div>
);

export default StatCard;
