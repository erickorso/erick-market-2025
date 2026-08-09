import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TradePanel from "./TradePanel";
import type { EnrichedStock } from "../../types";

const requestLogin = vi.hoisted(() => vi.fn());
const buyStock = vi.hoisted(() => vi.fn());
const login = vi.hoisted(() => vi.fn());
const contextState = vi.hoisted(() => ({
  fund: 10_000,
  isAuthenticated: true,
}));

vi.mock("../../context/StockContext", () => ({
  useStockContext: () => ({ buyStock, state: { fund: contextState.fund } }),
}));

vi.mock("../../context/AuthPromptContext", () => ({
  useAuthPrompt: () => ({ requestLogin, reason: null }),
}));

vi.mock("../../context/UserContext", () => ({
  useUser: () => ({ isAuthenticated: contextState.isAuthenticated, login }),
}));

vi.mock("../../context/I18nContext", () => ({
  useI18n: () => ({
    t: (key: string) =>
      ({
        quantity: "Quantity:",
        total: "Total:",
        buy: "Buy",
        insufficientFunds: "(insufficient funds)",
        decAria: "Decrease quantity",
        incAria: "Increase quantity",
        buyTooltipGuest: "Sign in to trade",
        buyTooltipFunds: "Not enough cash",
        buyTooltipOk: "Ready to buy",
      })[key] ?? key,
  }),
}));

function stock(over: Partial<EnrichedStock> = {}): EnrichedStock {
  return {
    id: "aapl",
    company: "Apple (AAPL)",
    price: 100,
    chartData: [],
    ...over,
  };
}

beforeEach(() => {
  buyStock.mockReset().mockResolvedValue(true);
  login.mockReset();
  requestLogin.mockReset();
  contextState.fund = 10_000;
  contextState.isAuthenticated = true;
});

describe("TradePanel", () => {
  it("shows the total for the current quantity", async () => {
    render(<TradePanel stock={stock({ price: 250 })} tipId="tip" />);

    expect(screen.getByTestId("totalPrice")).toHaveTextContent(
      "Total: $250.00",
    );

    await userEvent.click(screen.getByLabelText("Increase quantity"));
    expect(screen.getByTestId("totalPrice")).toHaveTextContent(
      "Total: $500.00",
    );
  });

  it("wires the buy button to its tooltip for screen readers", () => {
    render(<TradePanel stock={stock()} tipId="buy-tip-aapl" />);

    expect(screen.getByRole("button", { name: /buy/i })).toHaveAttribute(
      "aria-describedby",
      "buy-tip-aapl",
    );
    expect(screen.getByRole("tooltip")).toHaveAttribute("id", "buy-tip-aapl");
  });

  it("buys through the context on click", async () => {
    render(<TradePanel stock={stock()} tipId="tip" />);

    await userEvent.click(screen.getByRole("button", { name: /buy/i }));

    expect(buyStock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "aapl" }),
      1,
      expect.stringMatching(/^[A-Za-z0-9_-]{8,128}$/),
    );
  });

  describe("as a guest", () => {
    beforeEach(() => {
      contextState.isAuthenticated = false;
    });

    it("disables the stepper but keeps the buy button clickable", async () => {
      render(<TradePanel stock={stock()} tipId="tip" />);

      expect(screen.getByLabelText("Increase quantity")).toBeDisabled();
      expect(screen.getByLabelText("Decrease quantity")).toBeDisabled();

      const buy = screen.getByRole("button", { name: /buy/i });
      expect(buy).toBeEnabled();

      await userEvent.click(buy);
      // Asks first — leaving for Auth0 is the user's decision.
      expect(requestLogin).toHaveBeenCalledWith("trade");
      expect(login).not.toHaveBeenCalled();
      expect(buyStock).not.toHaveBeenCalled();
    });

    it("explains the guest state in the tooltip", () => {
      render(<TradePanel stock={stock()} tipId="tip" />);
      expect(screen.getByRole("tooltip")).toHaveTextContent("Sign in to trade");
    });
  });

  describe("without enough cash", () => {
    beforeEach(() => {
      contextState.fund = 50;
    });

    it("disables the button and says why", () => {
      render(<TradePanel stock={stock({ price: 100 })} tipId="tip" />);

      const buy = screen.getByRole("button", { name: /buy/i });
      expect(buy).toBeDisabled();
      expect(buy).toHaveTextContent("(insufficient funds)");
      expect(screen.getByRole("tooltip")).toHaveTextContent("Not enough cash");
    });
  });

  it("renders both size variants with the same controls", () => {
    const { rerender } = render(
      <TradePanel stock={stock()} tipId="tip" size="md" />,
    );
    expect(screen.getByTestId("quantity")).toHaveTextContent("1");

    rerender(<TradePanel stock={stock()} tipId="tip" size="sm" />);
    expect(screen.getByTestId("quantity")).toHaveTextContent("1");
    expect(screen.getByRole("button", { name: /buy/i })).toBeInTheDocument();
  });

  it("applies the caller's test id to the buy button", () => {
    render(
      <TradePanel
        stock={stock()}
        tipId="tip"
        buyTestId="addCart-Apple (AAPL)"
      />,
    );

    expect(screen.getByTestId("addCart-Apple (AAPL)")).toBeInTheDocument();
  });
});
