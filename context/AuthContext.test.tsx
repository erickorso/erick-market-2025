import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./AuthContext";

const auth0 = vi.hoisted(() => ({
  isLoading: false,
  isAuthenticated: true,
  user: null as Record<string, unknown> | null,
  loginWithRedirect: vi.fn(),
  logout: vi.fn(),
  getAccessTokenSilently: vi.fn(),
  getIdTokenClaims: vi.fn(),
}));

const config = vi.hoisted(() => ({
  configured: true,
  usesCustomApi: true,
}));

/** Captures what AuthProvider hands to the SDK, so its config is assertable. */
const providerProps = vi.hoisted(() => ({
  current: null as Record<string, unknown> | null,
}));

vi.mock("@auth0/auth0-react", () => ({
  Auth0Provider: ({
    children,
    ...props
  }: {
    children: React.ReactNode;
  } & Record<string, unknown>) => {
    providerProps.current = props;
    return <>{children}</>;
  },
  useAuth0: () => auth0,
}));

vi.mock("../auth/config", () => ({
  get auth0Domain() {
    return config.configured ? "tenant.eu.auth0.com" : "";
  },
  get auth0ClientId() {
    return config.configured ? "client123" : "";
  },
  auth0Audience: "https://erick-market-api",
  get auth0UsesCustomApi() {
    return config.usesCustomApi;
  },
  isAuth0Configured: () => config.configured,
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

beforeEach(() => {
  config.configured = true;
  config.usesCustomApi = true;
  auth0.isLoading = false;
  auth0.isAuthenticated = true;
  auth0.user = {
    sub: "auth0|1",
    name: "Erick",
    email: "trader@example.com",
    picture: "https://img.example/a.png",
  };
  auth0.loginWithRedirect.mockReset().mockResolvedValue(undefined);
  auth0.logout.mockReset();
  auth0.getAccessTokenSilently.mockReset().mockResolvedValue("access-token");
  auth0.getIdTokenClaims.mockReset().mockResolvedValue({ __raw: "id-token" });
});

describe("with Auth0 configured", () => {
  it("reports itself configured", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.configured).toBe(true);
  });

  it("maps the Auth0 claims", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual({
      sub: "auth0|1",
      name: "Erick",
      email: "trader@example.com",
      picture: "https://img.example/a.png",
    });
  });

  it("exposes no user before the session resolves", () => {
    auth0.user = null;
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.user).toBeNull();
  });

  it("passes the loading flag through", () => {
    auth0.isLoading = true;
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isLoading).toBe(true);
  });

  it("sends the user to Auth0 on login", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    act(() => result.current.login());
    expect(auth0.loginWithRedirect).toHaveBeenCalledTimes(1);
  });

  it("returns the user home on logout", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    act(() => result.current.logout());
    expect(auth0.logout).toHaveBeenCalledWith({
      logoutParams: { returnTo: window.location.origin },
    });
  });
});

describe("token retrieval", () => {
  it("asks for an access token scoped to the custom API", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(async () =>
      expect(await result.current.getAccessToken()).toBe("access-token"),
    );
    expect(auth0.getAccessTokenSilently).toHaveBeenCalledWith({
      authorizationParams: { audience: "https://erick-market-api" },
    });
  });

  it("uses the raw id token when there is no custom API", async () => {
    config.usesCustomApi = false;
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(await result.current.getAccessToken()).toBe("id-token");
    expect(auth0.getAccessTokenSilently).not.toHaveBeenCalled();
  });

  it("falls back to the id token when the access token fails", async () => {
    auth0.getAccessTokenSilently.mockRejectedValue(new Error("consent needed"));
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(await result.current.getAccessToken()).toBe("id-token");
  });

  it("returns null rather than throwing when both fail", async () => {
    auth0.getAccessTokenSilently.mockRejectedValue(new Error("no"));
    auth0.getIdTokenClaims.mockRejectedValue(new Error("also no"));
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(await result.current.getAccessToken()).toBeNull();
  });

  it("returns null when there are no claims to read", async () => {
    config.usesCustomApi = false;
    auth0.getIdTokenClaims.mockResolvedValue(undefined);
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(await result.current.getAccessToken()).toBeNull();
  });
});

describe("without Auth0 configured", () => {
  beforeEach(() => {
    config.configured = false;
  });

  it("degrades to an unconfigured, signed-out state", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.configured).toBe(false);
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it("explains itself instead of redirecting nowhere", () => {
    const alert = vi.spyOn(window, "alert").mockImplementation(() => {});
    const { result } = renderHook(() => useAuth(), { wrapper });

    act(() => result.current.login());

    expect(alert).toHaveBeenCalledWith(
      expect.stringMatching(/not configured/i),
    );
    expect(auth0.loginWithRedirect).not.toHaveBeenCalled();
  });

  it("hands out no token", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(await result.current.getAccessToken()).toBeNull();
  });

  it("logs out without error", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(() => act(() => result.current.logout())).not.toThrow();
  });
});

describe("SDK configuration", () => {
  it("passes the tenant and client through", () => {
    renderHook(() => useAuth(), { wrapper });

    expect(providerProps.current).toMatchObject({
      domain: "tenant.eu.auth0.com",
      clientId: "client123",
    });
  });

  it("survives a reload by caching the session in localStorage", () => {
    renderHook(() => useAuth(), { wrapper });
    expect(providerProps.current?.cacheLocation).toBe("localstorage");
  });

  it("asks for the custom API audience when there is one", () => {
    renderHook(() => useAuth(), { wrapper });

    expect(providerProps.current?.authorizationParams).toMatchObject({
      redirect_uri: window.location.origin,
      audience: "https://erick-market-api",
    });
  });

  it("omits the audience when the tenant has no custom API", () => {
    config.usesCustomApi = false;
    renderHook(() => useAuth(), { wrapper });

    expect(providerProps.current?.authorizationParams).not.toHaveProperty(
      "audience",
    );
  });
});

describe("redirect callback", () => {
  function redirect(appState?: { returnTo?: string }) {
    renderHook(() => useAuth(), { wrapper });
    (
      providerProps.current?.onRedirectCallback as (s?: {
        returnTo?: string;
      }) => void
    )(appState);
  }

  it("returns the user to where they were headed", () => {
    const replace = vi.spyOn(window.history, "replaceState");

    redirect({ returnTo: "/my-fund" });

    expect(replace).toHaveBeenCalledWith({}, document.title, "/my-fund");
  });

  it("falls back to the current path when Auth0 sends no state", () => {
    const replace = vi.spyOn(window.history, "replaceState");

    redirect(undefined);

    expect(replace).toHaveBeenCalledWith(
      {},
      document.title,
      window.location.pathname,
    );
  });

  // Otherwise Back would walk the user straight into the Auth0 round trip.
  it("replaces the callback URL rather than pushing it", () => {
    const push = vi.spyOn(window.history, "pushState");

    redirect({ returnTo: "/league" });

    expect(push).not.toHaveBeenCalled();
  });

  it("scrubs the Auth0 code and state out of the address bar", () => {
    window.history.replaceState({}, "", "/?code=abc&state=xyz");
    redirect({ returnTo: "/league" });

    expect(window.location.search).not.toContain("code=");
  });
});

describe("guard", () => {
  it("refuses to be used outside its provider", () => {
    expect(() => renderHook(() => useAuth())).toThrow(/AuthProvider/);
  });
});
