import React, { createContext, useCallback, useContext, useMemo } from "react";
import {
  Auth0Provider,
  useAuth0,
  type AppState,
} from "@auth0/auth0-react";
import {
  auth0Audience,
  auth0ClientId,
  auth0Domain,
  isAuth0Configured,
} from "../auth/config";

type AuthValue = {
  configured: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  user: { name?: string; email?: string; picture?: string; sub?: string } | null;
  login: () => void;
  logout: () => void;
  getAccessToken: () => Promise<string | null>;
};

const AuthContext = createContext<AuthValue | null>(null);

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
          "Auth0 is not configured. Set VITE_AUTH0_DOMAIN, VITE_AUTH0_CLIENT_ID and VITE_AUTH0_AUDIENCE.",
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
  } = useAuth0();

  const login = useCallback(() => {
    void loginWithRedirect();
  }, [loginWithRedirect]);

  const logout = useCallback(() => {
    auth0Logout({
      logoutParams: { returnTo: window.location.origin },
    });
  }, [auth0Logout]);

  const getAccessToken = useCallback(async () => {
    try {
      return await getAccessTokenSilently({
        authorizationParams: { audience: auth0Audience },
      });
    } catch {
      return null;
    }
  }, [getAccessTokenSilently]);

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
        audience: auth0Audience,
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
