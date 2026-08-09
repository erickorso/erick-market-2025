import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as AuthSession from "expo-auth-session";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import {
  AUTH0_AUDIENCE,
  AUTH0_CLIENT_ID,
  AUTH0_DOMAIN,
  authConfigured,
} from "./config";

WebBrowser.maybeCompleteAuthSession();

const REFRESH_KEY = "erick-market.refresh-token";
/**
 * PKCE verifier, parked where a cold start can still find it.
 *
 * The redirect does not always come back through promptAsync: a Custom Tab
 * can relaunch the activity instead of resuming it, and then the code arrives
 * as an ordinary deep link with the in-memory AuthRequest — and its verifier —
 * already gone. Persisting it is what lets that path finish the exchange.
 */
const VERIFIER_KEY = "erick-market.pkce-verifier";
/**
 * The path is not decoration. Auth0 refuses a custom scheme with an empty
 * authority — `erickmarket://` fails its callback-url format check — so the
 * redirect has to carry one, and this constant is what keeps the registered
 * URL and the requested one from drifting apart.
 */
const REDIRECT_PATH = "redirect";
/** Renew a little early rather than after the API has already refused. */
const RENEW_MARGIN_MS = 60_000;

type Session = { accessToken: string; expiresAt: number };

type AuthValue = {
  isLoading: boolean;
  isAuthenticated: boolean;
  /** Null when the dashboard side is not set up, so the UI can say so. */
  configured: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  /** Fresh token for an API call; renews on its own when close to expiry. */
  getAccessToken: (opts?: { forceRefresh?: boolean }) => Promise<string | null>;
  /** Finishes a login whose redirect arrived as a deep link. */
  completeAuthCode: (code: string) => Promise<boolean>;
};

const AuthContext = createContext<AuthValue | null>(null);

const discovery = {
  authorizationEndpoint: `https://${AUTH0_DOMAIN}/authorize`,
  tokenEndpoint: `https://${AUTH0_DOMAIN}/oauth/token`,
  revocationEndpoint: `https://${AUTH0_DOMAIN}/oauth/revoke`,
};

/**
 * Auth0 on native, deliberately the same shape the web provider exposes:
 * `getAccessToken` in, bearer token out. Everything under it differs — the
 * browser SDK cannot run here, there is no iframe to do silent auth in, and
 * the refresh token has to be stored somewhere the OS protects — but nothing
 * above it has to know that.
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [session, setSession] = useState<Session | null>(null);
  // False when there is nothing to restore, which removes the branch that
  // would otherwise have to set it synchronously inside an effect.
  const [isLoading, setIsLoading] = useState(authConfigured);
  // Read inside async work that outlives a render, so it cannot go stale.
  // Written in an effect, never during render: a render can be thrown away
  // under concurrent rendering, and a ref mutated in one that was discarded
  // is a lie the next render believes.
  const sessionRef = useRef<Session | null>(null);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const redirectUri = AuthSession.makeRedirectUri({
    scheme: "erickmarket",
    path: REDIRECT_PATH,
  });

  const exchange = useCallback(
    async (body: Record<string, string>): Promise<Session | null> => {
      try {
        const res = await fetch(discovery.tokenEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ client_id: AUTH0_CLIENT_ID, ...body }),
        });
        if (!res.ok) return null;
        const json = (await res.json()) as {
          access_token?: string;
          refresh_token?: string;
          expires_in?: number;
        };
        if (!json.access_token) return null;
        if (json.refresh_token) {
          await SecureStore.setItemAsync(REFRESH_KEY, json.refresh_token);
        }
        return {
          accessToken: json.access_token,
          expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
        };
      } catch {
        return null;
      }
    },
    [],
  );

  const renew = useCallback(async (): Promise<Session | null> => {
    const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
    if (!refreshToken) return null;
    const next = await exchange({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });
    // A refused refresh token is spent or revoked; keeping it would make every
    // future renewal fail silently for the life of the install.
    if (!next) await SecureStore.deleteItemAsync(REFRESH_KEY);
    setSession(next);
    return next;
  }, [exchange]);

  // Restoring the session on launch is what makes the app feel signed in
  // rather than asking again every cold start.
  useEffect(() => {
    if (!authConfigured) return;
    let cancelled = false;
    // Lands in a promise callback, not synchronously in the render pass.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void renew().finally(() => {
      if (!cancelled) setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [renew]);

  /**
   * The one place a code becomes a session, whichever route it took to get
   * here — promptAsync resolving, or the redirect landing as a deep link.
   */
  const completeAuthCode = useCallback(
    async (code: string) => {
      const verifier = await SecureStore.getItemAsync(VERIFIER_KEY);
      if (!verifier) return false;
      const next = await exchange({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        code_verifier: verifier,
      });
      // Single use: a verifier left behind would be tried against a future
      // code it does not belong to.
      await SecureStore.deleteItemAsync(VERIFIER_KEY);
      setSession(next);
      return Boolean(next);
    },
    [exchange, redirectUri],
  );

  const login = useCallback(async () => {
    if (!authConfigured) return;
    const request = new AuthSession.AuthRequest({
      clientId: AUTH0_CLIENT_ID,
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      // offline_access is what makes the refresh token above exist at all.
      scopes: ["openid", "profile", "email", "offline_access"],
      usePKCE: true,
      extraParams: AUTH0_AUDIENCE ? { audience: AUTH0_AUDIENCE } : undefined,
    });
    // Stored before the browser opens, because after it opens this process
    // may not be the one that comes back.
    await request.makeAuthUrlAsync(discovery);
    await SecureStore.setItemAsync(VERIFIER_KEY, request.codeVerifier ?? "");

    const result = await request.promptAsync(discovery);
    if (result.type !== "success" || !result.params.code) return;
    await completeAuthCode(result.params.code);
  }, [redirectUri, completeAuthCode]);

  const logout = useCallback(async () => {
    await SecureStore.deleteItemAsync(REFRESH_KEY);
    setSession(null);
    if (authConfigured) {
      // Clears the Auth0 session cookie too, so the next login actually asks
      // rather than silently signing the same account back in.
      await WebBrowser.openAuthSessionAsync(
        `https://${AUTH0_DOMAIN}/v2/logout?client_id=${AUTH0_CLIENT_ID}&returnTo=${encodeURIComponent(redirectUri)}`,
        redirectUri,
      );
    }
  }, [redirectUri]);

  const getAccessToken = useCallback(
    async ({ forceRefresh = false } = {}) => {
      const current = sessionRef.current;
      const stale =
        !current || current.expiresAt - RENEW_MARGIN_MS < Date.now();
      if (!forceRefresh && !stale) return current!.accessToken;
      const next = await renew();
      return next?.accessToken ?? null;
    },
    [renew],
  );

  const value = useMemo<AuthValue>(
    () => ({
      isLoading,
      isAuthenticated: Boolean(session),
      configured: authConfigured,
      login,
      logout,
      getAccessToken,
      completeAuthCode,
    }),
    [isLoading, session, login, logout, getAccessToken, completeAuthCode],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
