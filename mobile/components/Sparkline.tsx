import React, { useMemo } from "react";
import { View } from "react-native";
import Svg, { Path, Line } from "react-native-svg";
import type { ChartDataPoint } from "../../types";
import { useTheme } from "../lib/theme";

type Props = {
  data: ChartDataPoint[];
  height?: number;
  width?: number;
};

/**
 * Hand-rolled rather than a charting library.
 *
 * recharts is DOM-only, and the native charting packages bring a dependency
 * tree far heavier than the one path this needs. The series is a fixed handful
 * of daily closes — the whole thing is a min/max and a polyline.
 */
const Sparkline: React.FC<Props> = ({ data, height = 120, width = 300 }) => {
  const theme = useTheme();

  const { path, baseline, rising } = useMemo(() => {
    const points = data.filter((d) => Number.isFinite(d.price));
    if (points.length < 2) return { path: "", baseline: 0, rising: true };

    const prices = points.map((p) => p.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    // A flat series would divide by zero and collapse the line onto the top
    // edge; giving it a nominal range draws it through the middle instead.
    const range = max - min || Math.max(max * 0.01, 0.01);

    const pad = 6;
    const stepX = (width - pad * 2) / (points.length - 1);
    const y = (price: number) =>
      pad + (1 - (price - min) / range) * (height - pad * 2);

    const d = points
      .map((p, i) => `${i === 0 ? "M" : "L"}${pad + i * stepX},${y(p.price)}`)
      .join(" ");

    return {
      path: d,
      baseline: y(prices[0]),
      rising: prices[prices.length - 1] >= prices[0],
    };
  }, [data, height, width]);

  if (!path) {
    return <View style={{ height, width }} />;
  }

  const stroke = rising ? theme.up : theme.down;

  return (
    <Svg width={width} height={height}>
      {/* Where the series opened, so the line reads as up or down from
          something rather than as an abstract shape. */}
      <Line
        x1={0}
        y1={baseline}
        x2={width}
        y2={baseline}
        stroke={theme.border}
        strokeWidth={1}
        strokeDasharray="3 4"
      />
      <Path
        d={path}
        stroke={stroke}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
};

export default React.memo(Sparkline);
