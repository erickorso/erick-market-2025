import React, { useMemo } from "react";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ChartDataPoint } from "../../types";

interface StockChartProps {
  data: ChartDataPoint[];
  lineColor?: string;
  height?: number;
}

const StockChart: React.FC<StockChartProps> = ({
  data,
  lineColor = "#2dd4bf",
  height = 200,
}) => {
  // Recharts replays its draw animation whenever the data array identity
  // changes, so keep it stable across unrelated re-renders (price polling).
  const formattedData = useMemo(
    () => (data ?? []).map((d) => ({ ...d, price: Number(d.price) })),
    [data],
  );
  const reducedMotion = useReducedMotion();

  if (formattedData.length === 0) {
    return (
      <div className="p-4 text-center text-slate-600 dark:text-gray-400">No chart data available.</div>
    );
  }

  return (
    <div
      className="rounded-lg bg-gray-800/80 p-2 shadow"
      style={{ width: "100%", height }}
    >
      <ResponsiveContainer>
        <LineChart
          data={formattedData}
          margin={{ top: 5, right: 10, left: -25, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
          <XAxis dataKey="name" stroke="#9ca3af" fontSize={10} minTickGap={24} />
          <YAxis
            stroke="#9ca3af"
            fontSize={10}
            domain={["dataMin - 1", "dataMax + 1"]}
            width={45}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "rgba(31, 41, 55, 0.95)",
              border: "1px solid #4b5563",
              borderRadius: "0.375rem",
            }}
            labelStyle={{ color: "#e5e7eb", fontWeight: "bold" }}
            itemStyle={{ color: lineColor }}
          />
          <Line
            type="monotone"
            dataKey="price"
            stroke={lineColor}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            name="Price"
            isAnimationActive={!reducedMotion}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default React.memo(StockChart);
