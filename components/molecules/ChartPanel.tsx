import React from "react";
import type { ChartDataPoint } from "../../types";
import StockChart from "../atoms/Chart";
import ErrorBoundary from "../organisms/ErrorBoundary";

/** Titled chart block with the provenance of the series on the right. */
const ChartPanel: React.FC<{
  title: string;
  sourceLabel: string;
  simulated: boolean;
  data: ChartDataPoint[];
  height?: number;
  /** Shown in place of the chart if recharts throws. */
  errorLabel: string;
}> = ({ title, sourceLabel, simulated, data, height = 220, errorLabel }) => (
  <div>
    <div className="mb-2 flex items-center justify-between gap-2">
      <h3 className="text-sm font-semibold text-gray-200">{title}</h3>
      <span
        className={`text-[11px] ${
          simulated ? "text-amber-400" : "text-emerald-400"
        }`}
      >
        {sourceLabel}
      </span>
    </div>
    <div className="h-56">
      <ErrorBoundary
        source="chart"
        fallback={
          <div className="flex h-full items-center justify-center rounded-lg bg-gray-800/80 text-sm text-gray-500">
            {errorLabel}
          </div>
        }
      >
        <StockChart
          data={data}
          lineColor={simulated ? "#2dd4bf" : "#34d399"}
          height={height}
        />
      </ErrorBoundary>
    </div>
  </div>
);

export default ChartPanel;
