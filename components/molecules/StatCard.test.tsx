import { describe, expect, it } from "vitest";
import { renderWithProviders, screen } from "../../test/render";
import StatCard from "./StatCard";

describe("StatCard", () => {
  it("shows the label and the formatted figure", () => {
    renderWithProviders(<StatCard label="OPEN" value={212.05} />);

    expect(screen.getByText("OPEN")).toBeInTheDocument();
    expect(screen.getByText("$212.05")).toBeInTheDocument();
  });

  it("renders a dash when the provider omits the figure", () => {
    renderWithProviders(<StatCard label="PREV CLOSE" value={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders zero as a figure, not as missing", () => {
    renderWithProviders(<StatCard label="LOW" value={0} />);

    expect(screen.getByText("$0.00")).toBeInTheDocument();
    expect(screen.queryByText("—")).not.toBeInTheDocument();
  });

  it("uses a definition pair so the label and value stay associated", () => {
    const { container } = renderWithProviders(
      <StatCard label="HIGH" value={215.9} />,
    );

    expect(container.querySelector("dt")).toHaveTextContent("HIGH");
    expect(container.querySelector("dd")).toHaveTextContent("$215.90");
  });
});
