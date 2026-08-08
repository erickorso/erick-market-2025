import { act, renderHook } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { ThemeProvider, useTheme } from "./ThemeContext";

const THEME_KEY = "erick-market.theme";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = "";
  delete document.documentElement.dataset.theme;
});

describe("ThemeContext", () => {
  it("defaults to dark", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe("dark");
  });

  it("starts from the stored preference", () => {
    localStorage.setItem(THEME_KEY, "light");
    const { result } = renderHook(() => useTheme(), { wrapper });

    expect(result.current.theme).toBe("light");
  });

  it("ignores an unrecognised stored value", () => {
    localStorage.setItem(THEME_KEY, "sepia");
    const { result } = renderHook(() => useTheme(), { wrapper });

    expect(result.current.theme).toBe("dark");
  });

  it("drives Tailwind's dark class on the document", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(document.documentElement).toHaveClass("dark");

    act(() => result.current.setTheme("light"));
    expect(document.documentElement).not.toHaveClass("dark");
  });

  it("also exposes the mode as a data attribute", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => result.current.setTheme("light"));
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("toggles between the two modes", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => result.current.toggleTheme());
    expect(result.current.theme).toBe("light");

    act(() => result.current.toggleTheme());
    expect(result.current.theme).toBe("dark");
  });

  it("remembers the choice", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => result.current.toggleTheme());
    expect(localStorage.getItem(THEME_KEY)).toBe("light");
  });

  it("applies the theme before first paint, avoiding a flash", () => {
    localStorage.setItem(THEME_KEY, "light");
    renderHook(() => useTheme(), { wrapper });

    // The initialiser applies it, not an effect.
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("refuses to be used outside its provider", () => {
    expect(() => renderHook(() => useTheme())).toThrow(/ThemeProvider/);
  });
});
