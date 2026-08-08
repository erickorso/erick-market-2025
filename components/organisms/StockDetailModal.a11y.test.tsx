import { describe, it, vi } from "vitest";
import { renderWithProviders, screen } from "../../test/render";
import { expectNoA11yViolations } from "../../test/a11y";
import StockDetailModal from "./StockDetailModal";
import type { StockDetail } from "../../services/detailService";

const fetchStockDetail = vi.hoisted(() => vi.fn());

vi.mock("../../context/StockContext", () => ({
  useStockContext: () => ({
    state: { detailSymbol: "AAPL", allStocks: [], fund: 10_000 },
    dispatch: vi.fn(),
    buyStock: vi.fn(),
  }),
}));

vi.mock("../../context/UserContext", () => ({
  useUser: () => ({ isAuthenticated: true, login: vi.fn() }),
}));

vi.mock("../../services/detailService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/detailService")>()),
  fetchStockDetail,
}));

vi.mock("../atoms/Chart", () => ({
  default: () => <div role="img" aria-label="Price chart" />,
}));

const detail: StockDetail = {
  source: "live",
  chartSource: "yahoo",
  symbol: "AAPL",
  company: "Apple Inc.",
  tags: ["long-term", "blue-chip"],
  quote: {
    price: 214.32,
    change: 2.61,
    changePercent: 1.23,
    high: 215.9,
    low: 211.4,
    open: 212.05,
    previousClose: 211.71,
  },
  profile: {
    exchange: "NASDAQ",
    industry: "Technology",
    logo: null,
    weburl: "https://www.apple.com",
    marketCap: 3_240_000,
    sharesOutstanding: 15_200,
    ipo: "1980-12-12",
    country: "US",
    currency: "USD",
  },
  chart: [{ name: "5/1", price: 210 }],
};

describe("detail modal accessibility", () => {
  it("has no violations while loading", async () => {
    fetchStockDetail.mockReturnValue(new Promise(() => {}));
    const { container } = renderWithProviders(<StockDetailModal />);

    await expectNoA11yViolations(container);
  });

  it("has no violations once loaded", async () => {
    fetchStockDetail.mockResolvedValue(detail);
    const { container } = renderWithProviders(<StockDetailModal />);

    await screen.findByText("$214.32");
    await expectNoA11yViolations(container);
  });

  it("has no violations in the error state", async () => {
    fetchStockDetail.mockRejectedValue(new Error("upstream down"));
    const { container } = renderWithProviders(<StockDetailModal />);

    await screen.findByText("upstream down");
    await expectNoA11yViolations(container);
  });
});
