import React, { createContext, useCallback, useContext, useMemo } from "react";
import { Auth0Provider, useAuth0, type AppState } from "@auth0/auth0-react";
import {
  auth0Audience,
  auth0ClientId,
  auth0Domain,
  auth0UsesCustomApi,
  isAuth0Configured,
} from "../auth/config";

const E2E_AUTH_KEY = "erick-market.e2e-auth";
const e2eAuthEnabled =
  import.meta.env.DEV && import.meta.env.VITE_E2E_AUTH === "true";

type AuthValue = {
  configured: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  user: {
    name?: string;
    email?: string;
    picture?: string;
    sub?: string;
  } | null;
  login: () => void;
  logout: () => void;
  getAccessToken: (options?: {
    forceRefresh?: boolean;
  }) => Promise<string | null>;
};

const AuthContext = createContext<AuthValue | null>(null);

const E2EAuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [authenticated, setAuthenticated] = React.useState(() => {
    try {
      return localStorage.getItem(E2E_AUTH_KEY) === "1";
    } catch {
      return false;
    }
  });

  const login = useCallback(() => {
    localStorage.setItem(E2E_AUTH_KEY, "1");
    setAuthenticated(true);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(E2E_AUTH_KEY);
    setAuthenticated(false);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      configured: true,
      isLoading: false,
      isAuthenticated: authenticated,
      user: authenticated
        ? {
            name: "E2E Trader",
            email: "e2e@example.com",
            sub: "auth0|e2e-user",
          }
        : null,
      login,
      logout,
      getAccessToken: async () => (authenticated ? "e2e-test-token" : null),
    }),
    [authenticated, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

const FallbackAuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const value = useMemo<AuthValue>(
    () => ({
      configured: false,
      isLoading: false,
      isAuthenticated: false,
      user: null,
      login: () => {
        window.alert(
          "Auth0 is not configured. Set VITE_AUTH0_DOMAIN and VITE_AUTH0_CLIENT_ID.",
        );
      },
      logout: () => undefined,
      getAccessToken: async () => null,
    }),
    [],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

const Auth0Bridge: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    isLoading,
    isAuthenticated,
    user,
    loginWithRedirect,
    logout: auth0Logout,
    getAccessTokenSilently,
    getIdTokenClaims,
  } = useAuth0();

  const login = useCallback(() => {
    void loginWithRedirect();
  }, [loginWithRedirect]);

  const logout = useCallback(() => {
    auth0Logout({
      logoutParams: { returnTo: window.location.origin },
    });
  }, [auth0Logout]);

  /**
   * `forceRefresh` bypasses the SDK's token cache. Without it an expired token
   * is handed out indefinitely: the ID-token path just reads whatever is
   * cached, so the app keeps sending a dead credential and the API keeps
   * answering 401.
   */
  const getAccessToken = useCallback(
    async ({ forceRefresh = false } = {}) => {
      const cacheMode = forceRefresh ? ("off" as const) : undefined;
      try {
        if (auth0UsesCustomApi) {
          return await getAccessTokenSilently({
            authorizationParams: { audience: auth0Audience },
            ...(cacheMode ? { cacheMode } : {}),
          });
        }
        // Refreshing the session is what renews the ID token; the claims call
        // only reads the cache.
        if (forceRefresh) {
          await getAccessTokenSilently({ cacheMode: "off" }).catch(() => null);
        }
        const claims = await getIdTokenClaims();
        return claims?.__raw ?? null;
      } catch {
        try {
          const claims = await getIdTokenClaims();
          return claims?.__raw ?? null;
        } catch {
          return null;
        }
      }
    },
    [getAccessTokenSilently, getIdTokenClaims],
  );

  const value = useMemo<AuthValue>(
    () => ({
      configured: true,
      isLoading,
      isAuthenticated,
      user: user
        ? {
            name: user.name,
            email: user.email,
            picture: user.picture,
            sub: user.sub,
          }
        : null,
      login,
      logout,
      getAccessToken,
    }),
    [isLoading, isAuthenticated, user, login, logout, getAccessToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  if (e2eAuthEnabled) {
    return <E2EAuthProvider>{children}</E2EAuthProvider>;
  }

  if (!isAuth0Configured() || !auth0Domain || !auth0ClientId) {
    return <FallbackAuthProvider>{children}</FallbackAuthProvider>;
  }

  const onRedirectCallback = (appState?: AppState) => {
    const target = appState?.returnTo || window.location.pathname;
    window.history.replaceState({}, document.title, target);
  };

  return (
    <Auth0Provider
      domain={auth0Domain}
      clientId={auth0ClientId}
      authorizationParams={{
        redirect_uri: window.location.origin,
        ...(auth0UsesCustomApi ? { audience: auth0Audience } : {}),
      }}
      cacheLocation="localstorage"
      onRedirectCallback={onRedirectCallback}
    >
      <Auth0Bridge>{children}</Auth0Bridge>
    </Auth0Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
