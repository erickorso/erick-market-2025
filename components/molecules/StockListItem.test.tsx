import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, screen } from "../../test/render";
import StockListItem from "./StockListItem";
import type { EnrichedStock, PortfolioItem } from "../../types";

const navigate = vi.hoisted(() => vi.fn());
const catalog = vi.hoisted(() => ({ stocks: [] as EnrichedStock[] }));

vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => navigate,
}));

vi.mock("../../context/StockContext", () => ({
  useStockContext: () => ({ state: { allStocks: catalog.stocks } }),
}));

function position(over: Partial<PortfolioItem> = {}): PortfolioItem {
  return {
    stockId: "aapl",
    company: "Apple Inc. (AAPL)",
    quantity: 10,
    purchasePrice: 100,
    totalCost: 1000,
    ...over,
  };
}

function listed(price: number): EnrichedStock {
  return { id: "aapl", company: "Apple Inc. (AAPL)", price, chartData: [] };
}

beforeEach(() => {
  navigate.mockReset();
  catalog.stocks = [listed(100)];
});

describe("StockListItem", () => {
  it("shows the position and its cost basis", () => {
    renderWithProviders(<StockListItem item={position()} />);

    expect(screen.getByText("Apple Inc. (AAPL)")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getAllByText("$100.00").length).toBeGreaterThan(0);
  });

  it("marks the position to the live price", () => {
    catalog.stocks = [listed(150)];
    renderWithProviders(<StockListItem item={position()} />);

    expect(screen.getByText("$1500.00")).toBeInTheDocument();
  });

  it("reports a gain in green", () => {
    catalog.stocks = [listed(150)];
    renderWithProviders(<StockListItem item={position()} />);

    expect(screen.getByText(/\$500\.00 \(50\.00%\)/)).toHaveClass(
      "text-green-400",
    );
  });

  it("reports a loss in red", () => {
    catalog.stocks = [listed(80)];
    renderWithProviders(<StockListItem item={position()} />);

    expect(screen.getByText(/\$-200\.00 \(-20\.00%\)/)).toHaveClass(
      "text-red-400",
    );
  });

  it("falls back to the cost basis when the symbol is not quoted", () => {
    catalog.stocks = [];
    renderWithProviders(<StockListItem item={position()} />);

    expect(screen.getByText("$1000.00")).toBeInTheDocument();
    expect(screen.getByText(/\$0\.00 \(0\.00%\)/)).toBeInTheDocument();
  });

  it("avoids dividing by zero on a free position", () => {
    renderWithProviders(
      <StockListItem item={position({ totalCost: 0, purchasePrice: 0 })} />,
    );

    expect(screen.getByText(/\(0\.00%\)/)).toBeInTheDocument();
  });

  it("routes to sell with the company name encoded", async () => {
    renderWithProviders(<StockListItem item={position()} />);

    await userEvent.click(screen.getByTestId("sell"));

    expect(navigate).toHaveBeenCalledWith(
      "/sell/Apple%20Inc.%20(AAPL)",
    );
  });
});
