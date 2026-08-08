import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserProvider, useUser } from "./UserContext";

const fetchMe = vi.hoisted(() => vi.fn());
const getAccessToken = vi.hoisted(() => vi.fn());
const auth = vi.hoisted(() => ({
  configured: true,
  isLoading: false,
  isAuthenticated: true,
  user: null as { sub?: string; name?: string; email?: string } | null,
}));

vi.mock("../services/portfolioApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/portfolioApi")>()),
  fetchMe,
}));

vi.mock("./AuthContext", () => ({
  useAuth: () => ({
    ...auth,
    login: vi.fn(),
    logout: vi.fn(),
    getAccessToken,
  }),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <UserProvider>{children}</UserProvider>
);

const me = {
  user: {
    id: "u1",
    auth0_sub: "auth0|1",
    email: "trader@example.com",
    display_name: "Erick",
  },
  portfolio: { month: "2026-08", cash: 10_000, positions: [] },
};

beforeEach(() => {
  fetchMe.mockReset().mockResolvedValue(me);
  getAccessToken.mockReset().mockResolvedValue("tok");
  auth.configured = true;
  auth.isLoading = false;
  auth.isAuthenticated = true;
  auth.user = { sub: "auth0|1", name: "Erick V", email: "trader@example.com" };
});

describe("profile loading", () => {
  it("fetches the Neon profile once the session is ready", async () => {
    const { result } = renderHook(() => useUser(), { wrapper });

    await waitFor(() => expect(result.current.profile).not.toBeNull());
    expect(fetchMe).toHaveBeenCalledWith("tok");
    expect(result.current.portfolio?.cash).toBe(10_000);
  });

  it("waits while Auth0 is still resolving", () => {
    auth.isLoading = true;
    renderHook(() => useUser(), { wrapper });

    expect(fetchMe).not.toHaveBeenCalled();
  });

  it("does not fetch for a guest", async () => {
    auth.isAuthenticated = false;
    const { result } = renderHook(() => useUser(), { wrapper });

    await waitFor(() => expect(result.current.profileLoading).toBe(false));
    expect(fetchMe).not.toHaveBeenCalled();
    expect(result.current.profile).toBeNull();
  });

  it("reports the failure and holds no stale profile", async () => {
    fetchMe.mockRejectedValue(new Error("Neon unreachable"));
    const { result } = renderHook(() => useUser(), { wrapper });

    await waitFor(() =>
      expect(result.current.profileError).toBe("Neon unreachable"),
    );
    expect(result.current.profile).toBeNull();
    expect(result.current.portfolio).toBeNull();
  });

  it("treats a missing token as a profile failure", async () => {
    getAccessToken.mockResolvedValue(null);
    const { result } = renderHook(() => useUser(), { wrapper });

    await waitFor(() =>
      expect(result.current.profileError).toBe("No access token"),
    );
  });

  it("clears the spinner whatever the outcome", async () => {
    fetchMe.mockRejectedValue(new Error("nope"));
    const { result } = renderHook(() => useUser(), { wrapper });

    await waitFor(() => expect(result.current.profileLoading).toBe(false));
  });

  it("re-reads the profile on demand, after a trade", async () => {
    const { result } = renderHook(() => useUser(), { wrapper });
    await waitFor(() => expect(result.current.profile).not.toBeNull());
    fetchMe.mockClear();

    await act(async () => {
      await result.current.refreshProfile();
    });

    expect(fetchMe).toHaveBeenCalledTimes(1);
  });
});

describe("isLoading", () => {
  it("stays true until the Neon profile has landed, not just Auth0", async () => {
    let resolve: (v: unknown) => void = () => {};
    fetchMe.mockReturnValue(new Promise((r) => (resolve = r)));

    const { result } = renderHook(() => useUser(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(true));

    await act(async () => {
      resolve(me);
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it("does not wait on a profile for a guest", async () => {
    auth.isAuthenticated = false;
    const { result } = renderHook(() => useUser(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });
});

describe("identity", () => {
  it("exposes the Auth0 claims", async () => {
    const { result } = renderHook(() => useUser(), { wrapper });

    expect(result.current.auth?.sub).toBe("auth0|1");
    expect(result.current.auth?.email).toBe("trader@example.com");
  });

  it("is null when there is no session", () => {
    auth.user = null;
    const { result } = renderHook(() => useUser(), { wrapper });

    expect(result.current.auth).toBeNull();
  });

  it("prefers the stored display name", async () => {
    const { result } = renderHook(() => useUser(), { wrapper });
    await waitFor(() => expect(result.current.displayName).toBe("Erick"));
  });

  it("falls back to the Auth0 name, then the email", async () => {
    fetchMe.mockResolvedValue({
      ...me,
      user: { ...me.user, display_name: "" },
    });
    const { result } = renderHook(() => useUser(), { wrapper });
    await waitFor(() => expect(result.current.displayName).toBe("Erick V"));

    auth.user = { sub: "auth0|1", email: "only@example.com" };
    const second = renderHook(() => useUser(), { wrapper });
    await waitFor(() =>
      expect(second.result.current.displayName).toBe("only@example.com"),
    );
  });

  it("passes the configured flag through", () => {
    auth.configured = false;
    const { result } = renderHook(() => useUser(), { wrapper });

    expect(result.current.configured).toBe(false);
  });
});

describe("guard", () => {
  it("refuses to be used outside its provider", () => {
    expect(() => renderHook(() => useUser())).toThrow(/UserProvider/);
  });
});
