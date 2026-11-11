import { beforeEach, describe, expect, it } from "vitest";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, screen } from "../../test/render";
import WatchlistStar from "./WatchlistStar";

beforeEach(() => {
  localStorage.clear();
});

describe("WatchlistStar", () => {
  // The detail modal opens over the grid, so the same symbol has two stars on
  // screen at once. Starring in one must show in the other.
  it("keeps every star for a symbol in step", async () => {
    renderWithProviders(
      <>
        <WatchlistStar symbol="AAPL" />
        <WatchlistStar symbol="AAPL" />
        <WatchlistStar symbol="MSFT" />
      </>,
    );
    const [gridStar, detailStar] = screen.getAllByRole("button", {
      name: "Watch AAPL",
    });
    const other = screen.getByRole("button", { name: "Watch MSFT" });

    await userEvent.click(detailStar);

    expect(gridStar).toHaveAttribute("aria-pressed", "true");
    expect(detailStar).toHaveAttribute("aria-pressed", "true");
    expect(other).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(gridStar);

    expect(gridStar).toHaveAttribute("aria-pressed", "false");
    expect(detailStar).toHaveAttribute("aria-pressed", "false");
  });
});
