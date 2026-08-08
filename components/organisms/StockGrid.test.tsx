import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import StockGrid from "./StockGrid";
import type { EnrichedStock } from "../../types";

vi.mock("../../context/I18nContext", () => ({
  useI18n: () => ({
    t: (key: string) =>
      ({
        noStocks: "No stocks match this filter",
        loadMore: "Load more",
        loading: "Loading…",
      })[key] ?? key,
  }),
}));

vi.mock("./StockCard", () => ({
  default: ({ stock }: { stock: EnrichedStock }) => (
    <div data-testid="card">{stock.company}</div>
  ),
}));

function stock(id: string): EnrichedStock {
  return {
    id,
    company: `Company ${id}`,
    price: 100,
    chartData: [],
  };
}

const noop = () => {};

describe("StockGrid", () => {
  it("shows the empty state instead of a bare grid", () => {
    render(
      <StockGrid
        stocks={[]}
        hasMore={false}
        isLoadingMore={false}
        onLoadMore={noop}
      />,
    );

    expect(screen.getByText("No stocks match this filter")).toBeInTheDocument();
    expect(screen.queryByTestId("card")).not.toBeInTheDocument();
  });

  it("renders one card per stock", () => {
    render(
      <StockGrid
        stocks={[stock("a"), stock("b"), stock("c")]}
        hasMore={false}
        isLoadingMore={false}
        onLoadMore={noop}
      />,
    );

    expect(screen.getAllByTestId("card")).toHaveLength(3);
  });

  it("hides load more when the page is the last one", () => {
    render(
      <StockGrid
        stocks={[stock("a")]}
        hasMore={false}
        isLoadingMore={false}
        onLoadMore={noop}
      />,
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("pages on demand", async () => {
    const onLoadMore = vi.fn();
    render(
      <StockGrid
        stocks={[stock("a")]}
        hasMore
        isLoadingMore={false}
        onLoadMore={onLoadMore}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it("blocks a second page request while one is in flight", () => {
    render(
      <StockGrid
        stocks={[stock("a")]}
        hasMore
        isLoadingMore
        onLoadMore={noop}
      />,
    );

    const button = screen.getByRole("button", { name: "Loading…" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });
});
