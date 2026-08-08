import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, screen } from "../../test/render";
import CategoryFilter from "./CategoryFilter";
import { CATEGORIES } from "../../services/stockService";
import type { CategoryId } from "../../types";

const dispatch = vi.hoisted(() => vi.fn());
const store = vi.hoisted(() => ({ category: "all" as CategoryId }));

vi.mock("../../context/StockContext", () => ({
  useStockContext: () => ({ state: { category: store.category }, dispatch }),
}));

beforeEach(() => {
  dispatch.mockReset();
  store.category = "all";
});

describe("CategoryFilter", () => {
  it("offers every catalog category", () => {
    renderWithProviders(<CategoryFilter />);
    expect(screen.getAllByRole("button")).toHaveLength(CATEGORIES.length);
  });

  it("groups the filters and labels the group", () => {
    renderWithProviders(<CategoryFilter />);
    expect(screen.getByRole("group")).toHaveAccessibleName();
  });

  it("marks exactly one filter as pressed", () => {
    store.category = "growth";
    renderWithProviders(<CategoryFilter />);

    const pressed = screen
      .getAllByRole("button")
      .filter((b) => b.getAttribute("aria-pressed") === "true");

    expect(pressed).toHaveLength(1);
    expect(pressed[0]).toHaveTextContent("Growth");
  });

  it("switches category on click", async () => {
    renderWithProviders(<CategoryFilter />);

    await userEvent.click(screen.getByRole("button", { name: "Dividend" }));

    expect(dispatch).toHaveBeenCalledWith({
      type: "SET_CATEGORY",
      payload: "dividend",
    });
  });

  it("explains the active category below the filters", () => {
    store.category = "blue-chip";
    renderWithProviders(<CategoryFilter />);

    expect(
      screen.getByText(/Large, established names/i),
    ).toBeInTheDocument();
  });

  it("always repeats that the labels are educational", () => {
    renderWithProviders(<CategoryFilter />);
    expect(screen.getByText(/not investment advice/i)).toBeInTheDocument();
  });
});
