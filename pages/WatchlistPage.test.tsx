import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { act, renderWithProviders, screen } from "../test/render";
import WatchlistPage from "./WatchlistPage";
import WatchlistStar from "../components/molecules/WatchlistStar";
import { WATCHLIST_STORAGE_KEY } from "../services/localWatchlist";
import type { EnrichedStock } from "../types";

const dispatch = vi.hoisted(() => vi.fn());
const fetchQuotes = vi.hoisted(() => vi.fn());

vi.mock("../context/StockContext", () => ({
  useStockContext: () => ({ dispatch }),
}));

vi.mock("../services/stockService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/stockService")>()),
  fetchQuotes,
}));

function quote(
  over: Partial<EnrichedStock> & { symbol: string },
): EnrichedStock {
  return {
    id: over.symbol.toLowerCase(),
    company: `Company (${over.symbol})`,
    price: 100,
    changePercent: 1.5,
    chartData: [],
    quoteSource: "live",
    ...over,
  };
}

beforeEach(() => {
  localStorage.clear();
  dispatch.mockReset();
  fetchQuotes.mockReset().mockResolvedValue({ stocks: [], source: "live" });
});

/** The symbols on screen, in order. */
function items() {
  return screen
    .queryAllByTestId("watchlist-symbol")
    .map((el) => el.textContent);
}

describe("WatchlistPage", () => {
  it("lists the saved symbols in the order they were starred", () => {
    localStorage.setItem(WATCHLIST_STORAGE_KEY, '["MSFT","AAPL"]');

    renderWithProviders(<WatchlistPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Watchlist" }),
    ).toBeInTheDocument();
    expect(items()).toEqual(["MSFT", "AAPL"]);
  });

  it("removes one symbol and keeps the rest saved", async () => {
    localStorage.setItem(WATCHLIST_STORAGE_KEY, '["MSFT","AAPL"]');
    renderWithProviders(<WatchlistPage />);

    await userEvent.click(
      screen.getByRole("button", { name: "Remove AAPL from watchlist" }),
    );

    expect(items()).toEqual(["MSFT"]);
    expect(localStorage.getItem(WATCHLIST_STORAGE_KEY)).toBe('["MSFT"]');
    // The clicked button is gone; focus must not fall back to <body>.
    expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
  });

  it("shows the empty state and deletes the key when the last one goes", async () => {
    localStorage.setItem(WATCHLIST_STORAGE_KEY, '["AAPL"]');
    renderWithProviders(<WatchlistPage />);

    await userEvent.click(
      screen.getByRole("button", { name: "Remove AAPL from watchlist" }),
    );

    expect(items()).toEqual([]);
    expect(screen.getByText(/your watchlist is empty/i)).toBeInTheDocument();
    expect(localStorage.getItem(WATCHLIST_STORAGE_KEY)).toBeNull();
  });

  // The grid card and the detail modal both render this same star, so one
  // stands in for both. Unmounting everything before rendering the page means
  // the only thing carrying the symbol across is localStorage — as on reload.
  it("still lists a symbol starred before a reload", async () => {
    const before = renderWithProviders(<WatchlistStar symbol="NVDA" />);
    await userEvent.click(screen.getByRole("button", { name: "Watch NVDA" }));
    before.unmount();

    renderWithProviders(<WatchlistPage />);

    expect(items()).toEqual(["NVDA"]);
  });

  it("shows each symbol's price and day change", async () => {
    localStorage.setItem(WATCHLIST_STORAGE_KEY, '["NVDA"]');
    fetchQuotes.mockResolvedValue({
      stocks: [
        quote({
          symbol: "NVDA",
          company: "NVIDIA Corp. (NVDA)",
          price: 126.4,
          changePercent: 3.36,
        }),
      ],
      source: "live",
    });

    renderWithProviders(<WatchlistPage />);

    expect(await screen.findByText("$126.40")).toBeInTheDocument();
    expect(screen.getByText(/\+3\.36/)).toBeInTheDocument();
    // The name, without the "(NVDA)" the catalog appends.
    expect(screen.getByText("NVIDIA Corp.")).toBeInTheDocument();
    expect(fetchQuotes).toHaveBeenCalledWith(["NVDA"]);
  });

  it("labels a simulated quote, as the market grid does", async () => {
    localStorage.setItem(WATCHLIST_STORAGE_KEY, '["AAPL"]');
    fetchQuotes.mockResolvedValue({
      stocks: [quote({ symbol: "AAPL", quoteSource: "simulated" })],
      source: "mock",
    });

    renderWithProviders(<WatchlistPage />);

    expect(await screen.findByText("Mock quote")).toBeInTheDocument();
  });

  it("holds the price's place while quotes load, then shows a dash for none", async () => {
    localStorage.setItem(WATCHLIST_STORAGE_KEY, '["ZZZZ"]');
    let answer!: (value: unknown) => void;
    fetchQuotes.mockReturnValue(new Promise((r) => (answer = r)));

    const { container } = renderWithProviders(<WatchlistPage />);
    // The skeleton that stands in for the price (Skeleton h-10 w-20).
    expect(container.querySelector(".h-10.w-20")).not.toBeNull();

    await act(async () => answer({ stocks: [], source: "live" }));
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("opens the stock detail from a row", async () => {
    localStorage.setItem(WATCHLIST_STORAGE_KEY, '["AAPL"]');
    renderWithProviders(<WatchlistPage />);

    await userEvent.click(screen.getByRole("button", { name: /^AAPL/ }));

    expect(dispatch).toHaveBeenCalledWith({
      type: "OPEN_DETAIL",
      payload: "AAPL",
    });
  });
});
