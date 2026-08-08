import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, screen, waitFor } from "../../test/render";
import StockDetailModal from "./StockDetailModal";
import type { StockDetail } from "../../services/detailService";

const dispatch = vi.hoisted(() => vi.fn());
const buyStock = vi.hoisted(() => vi.fn());
const fetchStockDetail = vi.hoisted(() => vi.fn());
const store = vi.hoisted(() => ({ detailSymbol: null as string | null }));

vi.mock("../../context/StockContext", () => ({
  useStockContext: () => ({
    state: { detailSymbol: store.detailSymbol, allStocks: [], fund: 10_000 },
    dispatch,
    buyStock,
  }),
}));

vi.mock("../../context/UserContext", () => ({
  useUser: () => ({ isAuthenticated: true, login: vi.fn() }),
}));

vi.mock("../../services/detailService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/detailService")>()),
  fetchStockDetail,
}));

// recharts needs layout metrics jsdom does not provide.
vi.mock("../atoms/Chart", () => ({
  default: () => <div data-testid="chart" />,
}));

function detail(over: Partial<StockDetail> = {}): StockDetail {
  return {
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
    ...over,
  };
}

beforeEach(() => {
  dispatch.mockReset();
  buyStock.mockReset().mockResolvedValue(undefined);
  fetchStockDetail.mockReset().mockResolvedValue(detail());
  store.detailSymbol = "AAPL";
});

describe("when nothing is open", () => {
  it("renders nothing", () => {
    store.detailSymbol = null;
    const { container } = renderWithProviders(<StockDetailModal />);

    expect(container).toBeEmptyDOMElement();
    expect(fetchStockDetail).not.toHaveBeenCalled();
  });
});

describe("loading", () => {
  it("shows the skeleton while the payload is in flight", async () => {
    fetchStockDetail.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<StockDetailModal />);

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("shows the symbol in the header before the data lands", () => {
    fetchStockDetail.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<StockDetailModal />);

    expect(screen.getByText("AAPL")).toBeInTheDocument();
  });

  it("surfaces a load failure as text, not a crash", async () => {
    fetchStockDetail.mockRejectedValue(new Error("upstream down"));
    renderWithProviders(<StockDetailModal />);

    expect(await screen.findByText("upstream down")).toBeInTheDocument();
  });
});

describe("loaded", () => {
  it("renders the quote and session figures", async () => {
    renderWithProviders(<StockDetailModal />);

    expect(await screen.findByText("$214.32")).toBeInTheDocument();
    expect(screen.getByText("$212.05")).toBeInTheDocument();
    expect(screen.getByText("$215.90")).toBeInTheDocument();
    expect(screen.getByText("$211.40")).toBeInTheDocument();
    expect(screen.getByText("$211.71")).toBeInTheDocument();
  });

  it("renders the company profile", async () => {
    renderWithProviders(<StockDetailModal />);

    expect(await screen.findByText("NASDAQ")).toBeInTheDocument();
    expect(screen.getByText("Technology")).toBeInTheDocument();
    expect(screen.getByText("$3.24T")).toBeInTheDocument();
    expect(screen.getByText("1980-12-12")).toBeInTheDocument();
  });

  it("links to the company site in a safe new tab", async () => {
    renderWithProviders(<StockDetailModal />);

    const link = await screen.findByRole("link");
    expect(link).toHaveAttribute("href", "https://www.apple.com");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer");
  });

  it("omits the link when the provider has no site", async () => {
    fetchStockDetail.mockResolvedValue(
      detail({
        profile: { ...detail().profile, weburl: null },
      }),
    );
    renderWithProviders(<StockDetailModal />);

    await screen.findByText("$214.32");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("shows the style tags", async () => {
    renderWithProviders(<StockDetailModal />);

    expect(await screen.findByText("long-term")).toBeInTheDocument();
    expect(screen.getByText("blue-chip")).toBeInTheDocument();
  });

  it("labels a simulated history in amber", async () => {
    fetchStockDetail.mockResolvedValue(detail({ chartSource: "simulated" }));
    renderWithProviders(<StockDetailModal />);

    expect(
      await screen.findByText(/Simulated \(history unavailable\)/i),
    ).toBeInTheDocument();
  });

  it("offers the trade panel priced off the quote", async () => {
    renderWithProviders(<StockDetailModal />);

    expect(await screen.findByTestId("totalPrice")).toHaveTextContent(
      "$214.32",
    );
  });

  it("buys through the context", async () => {
    renderWithProviders(<StockDetailModal />);

    await userEvent.click(await screen.findByRole("button", { name: /buy/i }));
    expect(buyStock).toHaveBeenCalledWith(
      expect.objectContaining({ symbol: "AAPL" }),
      1,
    );
  });
});

describe("dismissal", () => {
  it("closes on the Close button", async () => {
    renderWithProviders(<StockDetailModal />);

    await userEvent.click(
      await screen.findByRole("button", { name: /close detail/i }),
    );
    expect(dispatch).toHaveBeenCalledWith({ type: "CLOSE_DETAIL" });
  });

  it("closes on Escape", async () => {
    renderWithProviders(<StockDetailModal />);
    await screen.findByText("$214.32");

    await userEvent.keyboard("{Escape}");
    expect(dispatch).toHaveBeenCalledWith({ type: "CLOSE_DETAIL" });
  });

  it("closes when the backdrop is clicked", async () => {
    renderWithProviders(<StockDetailModal />);
    await screen.findByText("$214.32");

    await userEvent.click(screen.getByRole("presentation"));
    expect(dispatch).toHaveBeenCalledWith({ type: "CLOSE_DETAIL" });
  });

  it("stays open when the dialog itself is clicked", async () => {
    renderWithProviders(<StockDetailModal />);
    await screen.findByText("$214.32");

    await userEvent.click(screen.getByRole("dialog"));
    expect(dispatch).not.toHaveBeenCalledWith({ type: "CLOSE_DETAIL" });
  });
});

describe("accessibility", () => {
  it("is a modal dialog labelled by its heading", async () => {
    renderWithProviders(<StockDetailModal />);

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleName("Apple Inc.");
  });

  it("takes focus when it opens", async () => {
    renderWithProviders(<StockDetailModal />);
    await waitFor(() => expect(screen.getByRole("dialog")).toHaveFocus());
  });
});
