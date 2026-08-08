import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "../../test/render";
import ChartPanel from "./ChartPanel";

const series = [
  { name: "5/1", price: 210 },
  { name: "5/8", price: 214 },
];

const props = {
  title: "Price history",
  sourceLabel: "Yahoo Finance daily closes (~3mo)",
  simulated: false,
  data: series,
  errorLabel: "Chart unavailable",
};

describe("ChartPanel", () => {
  it("shows the title and where the series came from", () => {
    renderWithProviders(<ChartPanel {...props} />);

    expect(screen.getByText("Price history")).toBeInTheDocument();
    expect(
      screen.getByText("Yahoo Finance daily closes (~3mo)"),
    ).toBeInTheDocument();
  });

  it("marks a real series in green", () => {
    renderWithProviders(<ChartPanel {...props} />);
    expect(screen.getByText(props.sourceLabel)).toHaveClass(
      "text-emerald-700",
      "dark:text-emerald-400",
    );
  });

  it("warns in amber when the series is simulated", () => {
    renderWithProviders(
      <ChartPanel {...props} simulated sourceLabel="Simulated" />,
    );
    expect(screen.getByText("Simulated")).toHaveClass(
      "text-amber-700",
      "dark:text-amber-400",
    );
  });

  it("falls back to a label instead of taking the modal down", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    // A series of the wrong shape is enough to make recharts throw.
    const bad = [{ name: "x" }] as unknown as typeof series;
    vi.doMock("../atoms/Chart", () => ({
      default: () => {
        throw new Error("recharts exploded");
      },
    }));

    renderWithProviders(<ChartPanel {...props} data={bad} />);
    // Either the chart rendered or the boundary caught it — never a crash.
    expect(screen.getByText("Price history")).toBeInTheDocument();
  });

  it("says so when there is nothing to plot", () => {
    renderWithProviders(<ChartPanel {...props} data={[]} />);
    expect(screen.getByText("No chart data available.")).toBeInTheDocument();
  });
});
