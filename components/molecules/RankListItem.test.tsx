import { describe, expect, it } from "vitest";
import { renderWithProviders, screen } from "../../test/render";
import RankListItem from "./RankListItem";

const props = {
  rank: 1,
  name: "Erick",
  equity: 11_842,
  pnlPercent: 18.4,
  mine: false,
};

describe("RankListItem", () => {
  it("shows rank, player and equity", () => {
    renderWithProviders(<RankListItem {...props} />);

    expect(screen.getByText("1.")).toBeInTheDocument();
    expect(screen.getByText("Erick")).toBeInTheDocument();
    // Equity is rendered without cents to fit the narrow sidebar.
    expect(screen.getByText("$11842")).toBeInTheDocument();
  });

  it("shows the return to one decimal", () => {
    renderWithProviders(<RankListItem {...props} />);
    expect(screen.getByText("+18.4%")).toBeInTheDocument();
  });

  it("colours a losing player red", () => {
    renderWithProviders(<RankListItem {...props} pnlPercent={-2.8} />);
    expect(screen.getByText("-2.8%")).toHaveClass("text-rose-600", "dark:text-rose-400");
  });

  it("highlights the viewer's own row", () => {
    const { container } = renderWithProviders(
      <RankListItem {...props} mine />,
    );
    expect(container.firstChild).toHaveClass("border-teal-500/50");
  });

  it("leaves other rows unhighlighted", () => {
    const { container } = renderWithProviders(<RankListItem {...props} />);
    expect(container.firstChild).not.toHaveClass("border-teal-500/50");
  });
});
