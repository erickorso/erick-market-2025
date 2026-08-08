import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import StockChart from "./Chart";
import type { ChartDataPoint } from "../../types";

const series: ChartDataPoint[] = [
  { name: "T-2", price: 185 },
  { name: "T-1", price: 188 },
  { name: "Now", price: 190 },
];

describe("StockChart", () => {
  it("says so when there is nothing to plot", () => {
    render(<StockChart data={[]} />);
    expect(screen.getByText("No chart data available.")).toBeInTheDocument();
  });

  it("handles a missing series without throwing", () => {
    render(<StockChart data={undefined as unknown as ChartDataPoint[]} />);
    expect(screen.getByText("No chart data available.")).toBeInTheDocument();
  });

  it("renders a chart container for a real series", () => {
    const { container } = render(<StockChart data={series} />);
    expect(screen.queryByText("No chart data available.")).not.toBeInTheDocument();
    expect(container.querySelector(".recharts-responsive-container")).not.toBeNull();
  });

  it("applies the requested height", () => {
    const { container } = render(<StockChart data={series} height={180} />);
    expect((container.firstChild as HTMLElement).style.height).toBe("180px");
  });

  // Recharts replays its draw animation whenever the data identity changes,
  // which is what made the detail modal flicker on every price poll.
  it("is memoised, so an unchanged series does not re-render it", () => {
    const { container, rerender } = render(<StockChart data={series} />);
    const before = container.innerHTML;

    rerender(<StockChart data={series} />);
    expect(container.innerHTML).toBe(before);
  });
});
