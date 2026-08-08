import { describe, expect, it } from "vitest";
import { renderWithProviders, screen } from "../../test/render";
import TagList from "./TagList";

describe("TagList", () => {
  it("renders one badge per tag", () => {
    renderWithProviders(<TagList tags={["long-term", "growth"]} />);

    expect(screen.getByText("long-term")).toBeInTheDocument();
    expect(screen.getByText("growth")).toBeInTheDocument();
  });

  it("renders nothing at all when there are no tags", () => {
    const { container } = renderWithProviders(<TagList tags={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("trims to max for the dense card grid", () => {
    renderWithProviders(
      <TagList tags={["a", "b", "c", "d", "e"]} max={3} />,
    );

    expect(screen.getByText("c")).toBeInTheDocument();
    expect(screen.queryByText("d")).not.toBeInTheDocument();
  });

  it("shows every tag when max is omitted", () => {
    renderWithProviders(<TagList tags={["a", "b", "c", "d"]} />);
    expect(screen.getByText("d")).toBeInTheDocument();
  });

  it("passes the size down to the badges", () => {
    renderWithProviders(<TagList tags={["growth"]} size="xs" />);
    expect(screen.getByText("growth")).toHaveClass("px-1.5");
  });

  it("accepts layout overrides from the caller", () => {
    const { container } = renderWithProviders(
      <TagList tags={["growth"]} className="mb-2 gap-1" />,
    );

    expect(container.firstChild).toHaveClass("mb-2", "gap-1");
  });
});
