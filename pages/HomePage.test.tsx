import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "../test/render";
import HomePage from "./HomePage";
import type { EnrichedStock } from "../types";

const store = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
}));

vi.mock("../context/StockContext", () => ({
  useStockContext: () => ({
    state: store.state,
    dispatch: vi.fn(),
    fetchStocks: vi.fn(),
    loadMore: vi.fn(),
  }),
}));

// Decoration and the card internals are covered elsewhere.
vi.mock("../components/organisms/MarketBackground", () => ({
  default: () => null,
}));
vi.mock("../components/organisms/StockCard", () => ({
  default: ({ stock }: { stock: EnrichedStock }) => (
    <div data-testid="card">{stock.company}</div>
  ),
}));

function state(over: Record<string, unknown> = {}) {
  return {
    allStocks: [
      { id: "aapl", company: "Apple Inc. (AAPL)", price: 1, chartData: [] },
    ],
    isLoading: false,
    isLoadingMore: false,
    error: null,
    searchTerm: "",
    category: "all",
    dataSource: "live",
    hasMore: false,
    total: 1,
    ...over,
  };
}

beforeEach(() => {
  store.state = state();
});

describe("HomePage", () => {
  it("shows the market once quotes are in", () => {
    renderWithProviders(<HomePage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Available Stocks" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("card")).toBeInTheDocument();
    expect(screen.getByText(/Showing 1 of 1/)).toBeInTheDocument();
  });

  // The whole page used to become a spinner: the heading (the LCP element)
  // waited on the API, and the category button just clicked was unmounted,
  // dropping keyboard focus to <body>.
  it("keeps the heading and the category filter while quotes load", () => {
    store.state = state({ isLoading: true });
    renderWithProviders(<HomePage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Available Stocks" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("group")).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "Loading…" }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("card")).not.toBeInTheDocument();
    // No stale count from the previous results while new ones load.
    expect(screen.queryByText(/Showing/)).not.toBeInTheDocument();
  });

  it("still offers a retry when loading fails", () => {
    store.state = state({ error: "upstream down" });
    renderWithProviders(<HomePage />);

    expect(screen.getByText(/upstream down/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
