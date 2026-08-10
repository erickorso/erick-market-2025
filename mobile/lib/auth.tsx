import React, { createContext, useCallback, useContext, useMemo } from "react";
import { Auth0Provider, useAuth0 } from "react-native-auth0";
import {
  AUTH0_AUDIENCE,
  AUTH0_CLIENT_ID,
  AUTH0_DOMAIN,
  authConfigured,
} from "./config";

/** Ask for a token that will still be valid by the time the request lands. */
const RENEW_MARGIN_SECONDS = 60;

type AuthValue = {
  isLoading: boolean;
  isAuthenticated: boolean;
  /** False when the dashboard side is not set up, so the UI can say so. */
  configured: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  /** Fresh token for an API call; renews on its own when close to expiry. */
  getAccessToken: (opts?: { forceRefresh?: boolean }) => Promise<string | null>;
};

const AuthContext = createContext<AuthValue | null>(null);

/**
 * Auth0 on native, through Auth0's own SDK.
 *
 * This began on expo-auth-session with PKCE by hand, which works right up
 * until the browser has to hand a custom scheme back to the app. That handoff
 * failed three separate ways: an unmatched route, then a consent screen whose
 * buttons went nowhere, then a blank tab — because a Custom Tab handed a 302
 * to `erickmarket://` has nothing to render, and Android silently remembers it
 * if you ever declined the prompt to open the app.
 *
 * This SDK registers a RedirectActivity in the Android manifest with its own
 * intent filter, so the callback returns natively and never depends on a
 * browser following a scheme it does not trust. That is the whole reason it
 * exists, and the reason the callback URL now follows Auth0's convention
 * rather than one we picked.
 *
 * Deliberately unchanged is the shape above this line: `getAccessToken` in,
 * bearer token out. The shared trading code never knew which SDK was
 * underneath, so replacing it needed no edits anywhere else.
 */
const Inner: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { authorize, clearSession, getCredentials, user, isLoading } =
    useAuth0();

  const login = useCallback(async () => {
    if (!authConfigured) return;
    try {
      await authorize({
        scope: "openid profile email offline_access",
        audience: AUTH0_AUDIENCE || undefined,
      });
    } catch {
      // Backing out of the browser throws here. Someone who changed their mind
      // did not hit an error, and saying so would be a lie.
    }
  }, [authorize]);

  const logout = useCallback(async () => {
    try {
      await clearSession();
    } catch {
      // Same: dismissing the logout page is a choice, not a failure.
    }
  }, [clearSession]);

  const getAccessToken = useCallback(
    async ({ forceRefresh = false } = {}) => {
      try {
        // The SDK keeps the refresh token in the platform keystore and renews
        // on its own. minTtl is how we ask for one with life left in it.
        const creds = await getCredentials(
          undefined,
          RENEW_MARGIN_SECONDS,
          {},
          forceRefresh,
        );
        return creds?.accessToken ?? null;
      } catch {
        return null;
      }
    },
    [getCredentials],
  );

  const value = useMemo<AuthValue>(
    () => ({
      isLoading,
      isAuthenticated: Boolean(user),
      configured: authConfigured,
      login,
      logout,
      getAccessToken,
    }),
    [isLoading, user, login, logout, getAccessToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <Auth0Provider domain={AUTH0_DOMAIN} clientId={AUTH0_CLIENT_ID}>
    <Inner>{children}</Inner>
  </Auth0Provider>
);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
