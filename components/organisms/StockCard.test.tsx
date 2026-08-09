import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import StockCard from "./StockCard";
import type { EnrichedStock } from "../../types";

const requestLogin = vi.hoisted(() => vi.fn());
const dispatch = vi.hoisted(() => vi.fn());
const buyStock = vi.hoisted(() => vi.fn());

vi.mock("../../context/StockContext", () => ({
  useStockContext: () => ({ dispatch, buyStock, state: { fund: 10_000 } }),
}));

vi.mock("../../context/AuthPromptContext", () => ({
  useAuthPrompt: () => ({ requestLogin, reason: null }),
}));

vi.mock("../../context/UserContext", () => ({
  useUser: () => ({ isAuthenticated: true, login: vi.fn() }),
}));

vi.mock("../../context/I18nContext", () => ({
  useI18n: () => ({
    t: (key: string) =>
      ({
        openDetail: "Open detail for",
        viewChartDetail: "View chart for",
        viewDetails: "View details",
        chartLive: "Live history",
        chartSim: "Simulated history",
        mockQuote: "Mock quote",
        todayPct: "% today",
        quantity: "Quantity:",
        total: "Total:",
        buy: "Buy",
        decAria: "Decrease quantity",
        incAria: "Increase quantity",
        buyTooltipOk: "Ready to buy",
      })[key] ?? key,
  }),
}));

// recharts needs layout metrics jsdom does not provide.
vi.mock("../atoms/Chart", () => ({
  default: () => <div data-testid="chart" />,
}));

function stock(over: Partial<EnrichedStock> = {}): EnrichedStock {
  return {
    id: "aapl",
    company: "Apple Inc. (AAPL)",
    symbol: "AAPL",
    price: 190.5,
    changePercent: 1.25,
    chartData: [{ name: "5/1", price: 188 }],
    chartSource: "yahoo",
    tags: ["long-term", "blue-chip", "growth"],
    ...over,
  };
}

beforeEach(() => {
  dispatch.mockReset();
  buyStock.mockReset().mockResolvedValue(true);
});

describe("StockCard", () => {
  it("renders the company, price and change", () => {
    render(<StockCard stock={stock()} />);

    expect(screen.getByText("Apple Inc. (AAPL)")).toBeInTheDocument();
    expect(screen.getByText("$190.50")).toBeInTheDocument();
    expect(screen.getByText(/\+1\.25/)).toBeInTheDocument();
  });

  it("colours a negative change differently", () => {
    render(<StockCard stock={stock({ changePercent: -2.5 })} />);

    const change = screen.getByText(/-2\.50/);
    expect(change).toHaveClass("text-rose-600", "dark:text-rose-400");
  });

  it("caps the tag list at three", () => {
    render(
      <StockCard
        stock={stock({
          tags: ["long-term", "blue-chip", "growth", "dividend", "volatile"],
        })}
      />,
    );

    expect(screen.getByText("long-term")).toBeInTheDocument();
    expect(screen.getByText("growth")).toBeInTheDocument();
    expect(screen.queryByText("dividend")).not.toBeInTheDocument();
  });

  it("labels the history provenance", () => {
    const { rerender } = render(<StockCard stock={stock()} />);
    expect(screen.getByText("Live history")).toBeInTheDocument();

    rerender(<StockCard stock={stock({ chartSource: "simulated" })} />);
    expect(screen.getByText("Simulated history")).toBeInTheDocument();
  });

  it("warns when the quote itself is simulated", () => {
    const { rerender } = render(<StockCard stock={stock()} />);
    expect(screen.queryByText("Mock quote")).not.toBeInTheDocument();

    rerender(<StockCard stock={stock({ quoteSource: "simulated" })} />);
    expect(screen.getByText("Mock quote")).toBeInTheDocument();
  });

  it("opens the detail modal from the title", async () => {
    render(<StockCard stock={stock()} />);

    await userEvent.click(
      screen.getByRole("button", { name: /open detail for/i }),
    );

    expect(dispatch).toHaveBeenCalledWith({
      type: "OPEN_DETAIL",
      payload: "AAPL",
    });
  });

  it("opens the detail modal from the chart", async () => {
    render(<StockCard stock={stock()} />);

    await userEvent.click(
      screen.getByRole("button", { name: /view chart for/i }),
    );

    expect(dispatch).toHaveBeenCalledWith({
      type: "OPEN_DETAIL",
      payload: "AAPL",
    });
  });

  it("derives the symbol from the company label when absent", async () => {
    render(<StockCard stock={stock({ symbol: undefined })} />);

    await userEvent.click(
      screen.getByRole("button", { name: /open detail for/i }),
    );

    expect(dispatch).toHaveBeenCalledWith({
      type: "OPEN_DETAIL",
      payload: "AAPL",
    });
  });

  it("buys through the shared trade panel", async () => {
    render(<StockCard stock={stock()} />);

    await userEvent.click(screen.getByTestId("addCart-Apple Inc. (AAPL)"));

    expect(buyStock).toHaveBeenCalledWith(
      expect.objectContaining({ symbol: "AAPL" }),
      1,
      expect.stringMatching(/^[A-Za-z0-9_-]{8,128}$/),
    );
  });

  it("does not open the detail modal when trading", async () => {
    render(<StockCard stock={stock()} />);

    await userEvent.click(screen.getByLabelText("Increase quantity"));

    expect(dispatch).not.toHaveBeenCalled();
    expect(screen.getByTestId("quantity")).toHaveTextContent("2");
  });
});
