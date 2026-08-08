import { describe, expect, it } from "vitest";
import { renderWithProviders, screen } from "../../test/render";
import DetailSkeleton from "./DetailSkeleton";

describe("DetailSkeleton", () => {
  it("announces itself as a busy region", () => {
    renderWithProviders(<DetailSkeleton label="Loading detail" />);

    const status = screen.getByRole("status");
    expect(status).toHaveAccessibleName("Loading detail");
  });

  it("animates so it reads as a placeholder, not as content", () => {
    renderWithProviders(<DetailSkeleton label="Loading" />);
    expect(screen.getByRole("status")).toHaveClass("animate-pulse");
  });

  // It exists to hold the modal's height steady between loading and loaded,
  // so it must mirror the real layout block for block.
  it("mirrors the four stat cards", () => {
    const { container } = renderWithProviders(<DetailSkeleton label="x" />);
    expect(container.querySelectorAll(".h-\\[3\\.625rem\\]")).toHaveLength(4);
  });

  it("mirrors the six company rows", () => {
    const { container } = renderWithProviders(<DetailSkeleton label="x" />);
    expect(container.querySelectorAll(".h-\\[2\\.0625rem\\]")).toHaveLength(6);
  });

  it("reserves the chart block at the same height as the real chart", () => {
    const { container } = renderWithProviders(<DetailSkeleton label="x" />);
    expect(container.querySelector(".h-56")).not.toBeNull();
  });

  it("carries no readable text that could be mistaken for data", () => {
    renderWithProviders(<DetailSkeleton label="Loading" />);
    expect(screen.getByRole("status").textContent).toBe("");
  });
});
