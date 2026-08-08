import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, screen } from "../../test/render";
import HotListItem from "./HotListItem";

const props = {
  rank: 1,
  symbol: "ABNB",
  company: "Airbnb",
  price: 178.07,
  changePercent: 17.43,
  onOpen: () => {},
};

describe("HotListItem", () => {
  it("shows rank, ticker, company and price", () => {
    renderWithProviders(<HotListItem {...props} />);

    expect(screen.getByText("1.")).toBeInTheDocument();
    expect(screen.getByText("ABNB")).toBeInTheDocument();
    expect(screen.getByText("Airbnb")).toBeInTheDocument();
    expect(screen.getByText("$178.07")).toBeInTheDocument();
  });

  it("colours a gain green", () => {
    renderWithProviders(<HotListItem {...props} />);
    expect(screen.getByText("+17.43%")).toHaveClass(
      "text-emerald-700",
      "dark:text-emerald-400",
    );
  });

  it("colours a loss red", () => {
    renderWithProviders(<HotListItem {...props} changePercent={-4.2} />);
    expect(screen.getByText("-4.20%")).toHaveClass(
      "text-rose-600",
      "dark:text-rose-400",
    );
  });

  it("opens the detail on click", async () => {
    const onOpen = vi.fn();
    renderWithProviders(<HotListItem {...props} onOpen={onOpen} />);

    await userEvent.click(screen.getByRole("button"));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("is a real button, so it is keyboard reachable", async () => {
    const onOpen = vi.fn();
    renderWithProviders(<HotListItem {...props} onOpen={onOpen} />);

    screen.getByRole("button").focus();
    await userEvent.keyboard("{Enter}");
    expect(onOpen).toHaveBeenCalled();
  });
});
