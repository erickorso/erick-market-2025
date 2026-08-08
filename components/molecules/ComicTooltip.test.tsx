import { describe, expect, it } from "vitest";
import { renderWithProviders, screen } from "../../test/render";
import ComicTooltip from "./ComicTooltip";

describe("ComicTooltip", () => {
  it("exposes itself as a tooltip with the id its trigger points at", () => {
    renderWithProviders(<ComicTooltip id="buy-tip">Ready to buy</ComicTooltip>);

    const tip = screen.getByRole("tooltip");
    expect(tip).toHaveAttribute("id", "buy-tip");
    expect(tip).toHaveTextContent("Ready to buy");
  });

  it("stays out of the pointer's way while hidden", () => {
    renderWithProviders(<ComicTooltip>hint</ComicTooltip>);

    const tip = screen.getByRole("tooltip");
    expect(tip).toHaveClass("pointer-events-none", "opacity-0");
  });

  it("centres on its trigger by default", () => {
    renderWithProviders(<ComicTooltip>hint</ComicTooltip>);

    const tip = screen.getByRole("tooltip");
    expect(tip).toHaveClass("left-1/2", "-translate-x-1/2");
  });

  // A centred bubble on a right-edge trigger overflowed the modal's scroll
  // container and produced a horizontal scrollbar.
  it("anchors right when asked, so it cannot overflow a right-edge trigger", () => {
    renderWithProviders(<ComicTooltip align="right">hint</ComicTooltip>);

    const tip = screen.getByRole("tooltip");
    expect(tip).toHaveClass("right-0");
    expect(tip).not.toHaveClass("left-1/2");
  });

  it("never grows wider than the viewport on a narrow screen", () => {
    renderWithProviders(<ComicTooltip>hint</ComicTooltip>);
    expect(screen.getByRole("tooltip").className).toContain("max-w-[min(");
  });

  it("reveals itself on hover and on focus within the trigger group", () => {
    renderWithProviders(<ComicTooltip>hint</ComicTooltip>);

    const cls = screen.getByRole("tooltip").className;
    expect(cls).toContain("group-hover:opacity-100");
    expect(cls).toContain("group-focus-within:opacity-100");
  });
});
