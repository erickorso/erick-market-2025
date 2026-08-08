import React from "react";
import type { ChartDataPoint } from "../../types";
import StockChart from "../atoms/Chart";

/** Titled chart block with the provenance of the series on the right. */
const ChartPanel: React.FC<{
  title: string;
  sourceLabel: string;
  simulated: boolean;
  data: ChartDataPoint[];
  height?: number;
}> = ({ title, sourceLabel, simulated, data, height = 220 }) => (
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
      <StockChart
        data={data}
        lineColor={simulated ? "#2dd4bf" : "#34d399"}
        height={height}
      />
    </div>
  </div>
);

export default ChartPanel;
