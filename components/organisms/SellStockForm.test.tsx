import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { fireEvent, renderWithProviders, screen } from "../../test/render";
import SellStockForm from "./SellStockForm";
import type { EnrichedStock, PortfolioItem } from "../../types";

const navigate = vi.hoisted(() => vi.fn());
const sellStock = vi.hoisted(() => vi.fn());
const store = vi.hoisted(() => ({
  portfolio: [] as PortfolioItem[],
  allStocks: [] as EnrichedStock[],
  param: "Apple%20Inc.%20(AAPL)" as string | undefined,
}));

vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => navigate,
  useParams: () => ({ stockCompany: store.param }),
}));

vi.mock("../../context/StockContext", () => ({
  useStockContext: () => ({
    state: { portfolio: store.portfolio, allStocks: store.allStocks },
    sellStock,
  }),
}));

beforeEach(() => {
  navigate.mockReset();
  sellStock.mockReset().mockResolvedValue(undefined);
  store.param = "Apple%20Inc.%20(AAPL)";
  store.portfolio = [
    {
      stockId: "aapl",
      company: "Apple Inc. (AAPL)",
      quantity: 10,
      purchasePrice: 100,
      totalCost: 1000,
    },
  ];
  store.allStocks = [
    { id: "aapl", company: "Apple Inc. (AAPL)", price: 150, chartData: [] },
  ];
});

describe("when the position is missing", () => {
  it("says so instead of rendering a broken form", () => {
    store.portfolio = [];
    renderWithProviders(<SellStockForm />);

    expect(screen.getByRole("heading")).toHaveTextContent("Error");
    expect(screen.queryByTestId("form")).not.toBeInTheDocument();
  });

  it("offers a way back", async () => {
    store.portfolio = [];
    renderWithProviders(<SellStockForm />);

    await userEvent.click(screen.getByRole("button"));
    expect(navigate).toHaveBeenCalledWith("/my-stocks");
  });

  it("also guards against a symbol that is no longer quoted", () => {
    store.allStocks = [];
    renderWithProviders(<SellStockForm />);

    expect(screen.queryByTestId("form")).not.toBeInTheDocument();
  });
});

describe("with a held position", () => {
  it("decodes the company out of the route", () => {
    renderWithProviders(<SellStockForm />);
    expect(screen.getByDisplayValue("Apple Inc. (AAPL)")).toBeInTheDocument();
  });

  it("prices the sale at the live price", () => {
    renderWithProviders(<SellStockForm />);
    expect(screen.getByText(/150\.00 per share/)).toBeInTheDocument();
  });

  it("totals the sale for the chosen quantity", () => {
    renderWithProviders(<SellStockForm />);

    // The field is controlled and floors at 1, so set it rather than typing.
    fireEvent.change(screen.getByLabelText(/quantity/i), {
      target: { value: "4" },
    });

    expect(screen.getByTestId("form")).toHaveTextContent(
      "Total Value: $600.00",
    );
  });

  it("floors the quantity at one", () => {
    renderWithProviders(<SellStockForm />);
    const input = screen.getByLabelText(/quantity/i);

    fireEvent.change(input, { target: { value: "0" } });
    expect(input).toHaveValue(1);

    fireEvent.change(input, { target: { value: "" } });
    expect(input).toHaveValue(1);
  });

  it("caps the input at the held quantity", () => {
    renderWithProviders(<SellStockForm />);
    expect(screen.getByLabelText(/quantity/i)).toHaveAttribute("max", "10");
  });

  it("sells and returns to the portfolio", async () => {
    renderWithProviders(<SellStockForm />);

    await userEvent.click(screen.getByTestId("sell"));

    expect(sellStock).toHaveBeenCalledWith("Apple Inc. (AAPL)", 1, 150);
    expect(navigate).toHaveBeenCalledWith("/my-stocks");
  });

  it("refuses to sell more than is held", async () => {
    renderWithProviders(<SellStockForm />);

    fireEvent.change(screen.getByLabelText(/quantity/i), {
      target: { value: "50" },
    });
    await userEvent.click(screen.getByTestId("sell"));

    expect(sellStock).not.toHaveBeenCalled();
    expect(screen.getByText(/only sell up to 10/i)).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("keeps the user on the form when the trade fails", async () => {
    sellStock.mockRejectedValueOnce(new Error("market closed"));
    renderWithProviders(<SellStockForm />);

    await userEvent.click(screen.getByTestId("sell"));

    expect(screen.getByText("market closed")).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("can be abandoned", async () => {
    renderWithProviders(<SellStockForm />);

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(navigate).toHaveBeenCalledWith("/my-stocks");
  });
});
