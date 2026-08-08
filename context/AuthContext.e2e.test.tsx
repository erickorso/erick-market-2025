import { act, renderHook } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The E2E auth provider is selected by a module-level constant read at import
 * time, so the flag has to be set before AuthContext is evaluated — hence
 * vi.hoisted, and hence a second test file for the same source rather than a
 * vi.resetModules() dance (which makes v8 report the module twice).
 *
 * This provider is what lets the Playwright suite exercise authenticated flows
 * with no Auth0 tenant, so it is worth pinning down: it must never activate in
 * a production build, and it must hand out an obviously synthetic token.
 */
vi.hoisted(() => {
  vi.stubEnv("VITE_E2E_AUTH", "true");
});

const useAuth0 = vi.hoisted(() => vi.fn());

vi.mock("@auth0/auth0-react", () => ({
  Auth0Provider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth0,
}));

const { AuthProvider, useAuth } = await import("./AuthContext");

const E2E_KEY = "erick-market.e2e-auth";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

beforeEach(() => {
  localStorage.clear();
  useAuth0.mockReset();
});

describe("E2E auth provider", () => {
  it("takes over from the Auth0 SDK entirely", () => {
    renderHook(() => useAuth(), { wrapper });
    expect(useAuth0).not.toHaveBeenCalled();
  });

  it("reports itself configured, so guards do not show the setup warning", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.configured).toBe(true);
    expect(result.current.isLoading).toBe(false);
  });

  it("starts signed out", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it("resumes the session Playwright seeded into storage", () => {
    localStorage.setItem(E2E_KEY, "1");
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.sub).toBe("auth0|e2e-user");
  });

  it("signs in without a redirect", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    act(() => result.current.login());

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.email).toBe("e2e@example.com");
    expect(localStorage.getItem(E2E_KEY)).toBe("1");
  });

  it("signs out and clears the flag", () => {
    localStorage.setItem(E2E_KEY, "1");
    const { result } = renderHook(() => useAuth(), { wrapper });

    act(() => result.current.logout());

    expect(result.current.isAuthenticated).toBe(false);
    expect(localStorage.getItem(E2E_KEY)).toBeNull();
  });

  it("hands out an obviously synthetic token, never a real one", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    act(() => result.current.login());

    expect(await result.current.getAccessToken()).toBe("e2e-test-token");
  });

  it("hands out no token while signed out", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(await result.current.getAccessToken()).toBeNull();
  });

  it("survives storage being unavailable", () => {
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });

    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.isAuthenticated).toBe(false);

    getItem.mockRestore();
  });
});
