import { describe, expect, it } from "vitest";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, screen } from "../../test/render";
import DisclaimerNote from "./DisclaimerNote";

describe("DisclaimerNote", () => {
  it("starts collapsed", () => {
    renderWithProviders(<DisclaimerNote />);

    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  it("reveals the disclaimer on click", async () => {
    renderWithProviders(<DisclaimerNote />);

    await userEvent.click(screen.getByRole("button"));

    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("note")).toBeInTheDocument();
  });

  it("collapses again on a second click", async () => {
    renderWithProviders(<DisclaimerNote />);
    const toggle = screen.getByRole("button");

    await userEvent.click(toggle);
    await userEvent.click(toggle);

    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  it("points aria-controls at the region it toggles", async () => {
    renderWithProviders(<DisclaimerNote />);
    const toggle = screen.getByRole("button");

    expect(toggle).toHaveAttribute("aria-controls", "hot-disclaimer");
    await userEvent.click(toggle);
    expect(screen.getByRole("note")).toHaveAttribute("id", "hot-disclaimer");
  });

  it("carries the disclaimer text in its title while collapsed", () => {
    renderWithProviders(<DisclaimerNote />);
    expect(screen.getByRole("button")).toHaveAttribute("title");
  });
});
