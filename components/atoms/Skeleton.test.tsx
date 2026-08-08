import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Skeleton from "./Skeleton";

describe("Skeleton", () => {
  it("takes its size from the caller", () => {
    const { container } = render(<Skeleton className="h-9 w-40" />);
    expect(container.firstChild).toHaveClass("h-9", "w-40");
  });

  it("defaults to a plain filled block", () => {
    const { container } = render(<Skeleton />);
    expect(container.firstChild).toHaveClass("bg-gray-800");
    expect(container.firstChild).not.toHaveClass("border-gray-700");
  });

  it("can mirror a bordered block such as a stat card", () => {
    const { container } = render(<Skeleton bordered />);
    expect(container.firstChild).toHaveClass("border-gray-700");
  });

  it("renders nothing readable, so it stays out of the a11y tree", () => {
    const { container } = render(<Skeleton className="h-4" />);
    expect(container.textContent).toBe("");
  });
});
