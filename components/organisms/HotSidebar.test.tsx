import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, screen } from "../../test/render";
import HotSidebar from "./HotSidebar";

const dispatch = vi.hoisted(() => vi.fn());
const hot = vi.hoisted(() => ({
  stocks: [] as {
    symbol: string;
    company: string;
    price: number;
    changePercent: number;
  }[],
  mode: "poll" as "socket" | "poll" | "connecting",
  updatedAt: null as number | null,
  error: null as string | null,
  refreshMs: 300_000,
}));

vi.mock("../../hooks/useHotStocks", () => ({
  useHotStocks: () => hot,
}));

vi.mock("../../context/StockContext", () => ({
  useStockContext: () => ({ dispatch }),
}));

beforeEach(() => {
  dispatch.mockReset();
  hot.stocks = [
    { symbol: "ABNB", company: "Airbnb", price: 178.07, changePercent: 17.43 },
    { symbol: "UBER", company: "Uber", price: 75.02, changePercent: 6.46 },
  ];
  hot.mode = "poll";
  hot.updatedAt = Date.now();
  hot.error = null;
});

describe("HotSidebar", () => {
  it("is a labelled landmark", () => {
    renderWithProviders(<HotSidebar />);
    expect(screen.getByRole("complementary")).toHaveAccessibleName();
  });

  it("ranks the gainers in order", () => {
    renderWithProviders(<HotSidebar />);

    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("ABNB");
    expect(items[1]).toHaveTextContent("UBER");
  });

  it("opens the detail for the row clicked", async () => {
    renderWithProviders(<HotSidebar />);

    await userEvent.click(screen.getByText("UBER"));
    expect(dispatch).toHaveBeenCalledWith({
      type: "OPEN_DETAIL",
      payload: "UBER",
    });
  });

  it("says it is polling when there is no socket", () => {
    renderWithProviders(<HotSidebar />);
    expect(screen.getByText("Poll · 5m")).toBeInTheDocument();
  });

  it("says it is live on a socket", () => {
    hot.mode = "socket";
    renderWithProviders(<HotSidebar />);
    expect(screen.getByText("WS · live")).toBeInTheDocument();
  });

  it("shows how long ago the data was refreshed", () => {
    hot.updatedAt = Date.now() - 90_000;
    renderWithProviders(<HotSidebar />);
    expect(screen.getByText(/1m/)).toBeInTheDocument();
  });

  it("shows a dash before the first update lands", () => {
    hot.updatedAt = null;
    renderWithProviders(<HotSidebar />);
    expect(screen.getByText(/—/)).toBeInTheDocument();
  });

  it("warns when the feed is unavailable", () => {
    hot.error = "socket closed";
    renderWithProviders(<HotSidebar />);
    expect(screen.getAllByRole("status").length).toBeGreaterThan(0);
  });

  it("shows a loading row rather than an empty list", () => {
    hot.stocks = [];
    renderWithProviders(<HotSidebar />);

    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.queryByText("ABNB")).not.toBeInTheDocument();
  });

  it("carries the disclaimer", () => {
    renderWithProviders(<HotSidebar />);
    expect(screen.getByText("Info")).toBeInTheDocument();
  });
});
