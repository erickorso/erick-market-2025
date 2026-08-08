import { act, renderHook } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { I18nProvider, useI18n } from "./I18nContext";
import { LANG_KEY } from "../i18n/locales";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <I18nProvider>{children}</I18nProvider>
);

beforeEach(() => {
  localStorage.clear();
});

describe("I18nContext", () => {
  it("defaults to English", () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.lang).toBe("en");
  });

  it("starts from the stored language", () => {
    localStorage.setItem(LANG_KEY, "es");
    const { result } = renderHook(() => useI18n(), { wrapper });

    expect(result.current.lang).toBe("es");
    expect(result.current.t("navHome")).toBe("Inicio");
  });

  it("ignores an unrecognised stored value", () => {
    localStorage.setItem(LANG_KEY, "fr");
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.lang).toBe("en");
  });

  it("translates a key", () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.t("navHome")).toBe("Home");
  });

  it("interpolates variables", () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.t("canSellUpTo", { max: 10 })).toContain("10");
  });

  it("toggles between the two languages", () => {
    const { result } = renderHook(() => useI18n(), { wrapper });

    act(() => result.current.toggleLang());
    expect(result.current.lang).toBe("es");

    act(() => result.current.toggleLang());
    expect(result.current.lang).toBe("en");
  });

  it("sets a language directly", () => {
    const { result } = renderHook(() => useI18n(), { wrapper });

    act(() => result.current.setLang("es"));
    expect(result.current.t("navHome")).toBe("Inicio");
  });

  it("remembers the choice", () => {
    const { result } = renderHook(() => useI18n(), { wrapper });

    act(() => result.current.setLang("es"));
    expect(localStorage.getItem(LANG_KEY)).toBe("es");
  });

  it("reflects the language on the document, for screen readers", () => {
    const { result } = renderHook(() => useI18n(), { wrapper });

    act(() => result.current.setLang("es"));
    expect(document.documentElement.lang).toBe("es");
  });

  it("refuses to be used outside its provider", () => {
    expect(() => renderHook(() => useI18n())).toThrow(/I18nProvider/);
  });
});
