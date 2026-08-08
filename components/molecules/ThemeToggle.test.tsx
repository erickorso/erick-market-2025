import { beforeEach, describe, expect, it } from "vitest";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, screen } from "../../test/render";
import ThemeToggle from "./ThemeToggle";

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = "";
});

describe("ThemeToggle", () => {
  it("offers to switch to light while dark is active", () => {
    renderWithProviders(<ThemeToggle />);
    expect(
      screen.getByRole("button", { name: /light mode/i }),
    ).toBeInTheDocument();
  });

  it("flips the label after toggling", async () => {
    renderWithProviders(<ThemeToggle />);

    await userEvent.click(screen.getByRole("button"));
    expect(
      screen.getByRole("button", { name: /dark mode/i }),
    ).toBeInTheDocument();
  });

  it("applies the theme to the document", async () => {
    renderWithProviders(<ThemeToggle />);
    expect(document.documentElement).toHaveClass("dark");

    await userEvent.click(screen.getByRole("button"));
    expect(document.documentElement).not.toHaveClass("dark");
  });

  it("remembers the choice across reloads", async () => {
    renderWithProviders(<ThemeToggle />);

    await userEvent.click(screen.getByRole("button"));
    expect(localStorage.getItem("erick-market.theme")).toBe("light");
  });

  it("starts from the stored preference", () => {
    localStorage.setItem("erick-market.theme", "light");
    renderWithProviders(<ThemeToggle />);

    expect(
      screen.getByRole("button", { name: /dark mode/i }),
    ).toBeInTheDocument();
  });

  it("hides the decorative icon from screen readers", () => {
    const { container } = renderWithProviders(<ThemeToggle />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden");
  });
});
