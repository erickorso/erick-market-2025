import { describe, it, vi } from "vitest";
import { renderWithProviders } from "../../test/render";
import { expectNoA11yViolations } from "../../test/a11y";
import StockCard from "./StockCard";
import TradePanel from "../molecules/TradePanel";
import StockGrid from "./StockGrid";
import type { EnrichedStock } from "../../types";

const requestLogin = vi.hoisted(() => vi.fn());
const authed = vi.hoisted(() => ({ isAuthenticated: true }));

vi.mock("../../context/StockContext", () => ({
  useStockContext: () => ({
    dispatch: vi.fn(),
    buyStock: vi.fn(),
    state: { fund: 10_000 },
  }),
}));

vi.mock("../../context/AuthPromptContext", () => ({
  useAuthPrompt: () => ({ requestLogin, reason: null }),
}));

vi.mock("../../context/UserContext", () => ({
  useUser: () => ({ isAuthenticated: authed.isAuthenticated, login: vi.fn() }),
}));

vi.mock("../atoms/Chart", () => ({
  default: () => <div role="img" aria-label="Price chart" />,
}));

function stock(over: Partial<EnrichedStock> = {}): EnrichedStock {
  return {
    id: "aapl",
    company: "Apple Inc. (AAPL)",
    symbol: "AAPL",
    price: 214.32,
    changePercent: 1.23,
    chartData: [{ name: "5/1", price: 210 }],
    chartSource: "yahoo",
    tags: ["long-term", "blue-chip", "growth"],
    ...over,
  };
}

describe("market grid accessibility", () => {
  it("a card has no axe violations", async () => {
    const { container } = renderWithProviders(<StockCard stock={stock()} />);
    await expectNoA11yViolations(container);
  });

  it("a card is clean for a guest, with the stepper disabled", async () => {
    authed.isAuthenticated = false;
    const { container } = renderWithProviders(<StockCard stock={stock()} />);
    await expectNoA11yViolations(container);
    authed.isAuthenticated = true;
  });

  it("a card carrying the mock-quote warning stays clean", async () => {
    const { container } = renderWithProviders(
      <StockCard stock={stock({ quoteSource: "simulated" })} />,
    );
    await expectNoA11yViolations(container);
  });

  it("the trade panel has no violations at either size", async () => {
    const { container, rerender } = renderWithProviders(
      <TradePanel stock={stock()} tipId="tip" size="md" />,
    );
    await expectNoA11yViolations(container);

    rerender(<TradePanel stock={stock()} tipId="tip" size="sm" />);
    await expectNoA11yViolations(container);
  });

  it("the grid has no violations", async () => {
    const { container } = renderWithProviders(
      <StockGrid
        stocks={[stock(), stock({ id: "msft", company: "Microsoft (MSFT)" })]}
        hasMore
        isLoadingMore={false}
        onLoadMore={() => {}}
      />,
    );
    await expectNoA11yViolations(container);
  });

  it("the empty grid has no violations", async () => {
    const { container } = renderWithProviders(
      <StockGrid
        stocks={[]}
        hasMore={false}
        isLoadingMore={false}
        onLoadMore={() => {}}
      />,
    );
    await expectNoA11yViolations(container);
  });
});
