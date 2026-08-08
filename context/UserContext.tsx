import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "./AuthContext";
import {
  ApiError,
  fetchMe,
  type ApiPortfolio,
  type ApiUser,
} from "../services/portfolioApi";

export type AuthIdentity = {
  sub?: string;
  name?: string;
  email?: string;
  picture?: string;
};

type UserContextValue = {
  /** Auth0 configured in env */
  configured: boolean;
  /** Auth0 SDK loading */
  isLoading: boolean;
  /** Auth0 session present */
  isAuthenticated: boolean;
  /** Auth0 identity (token claims) */
  auth: AuthIdentity | null;
  /** Neon user row from /api/me */
  profile: ApiUser | null;
  /** Latest portfolio snapshot from /api/me */
  portfolio: ApiPortfolio | null;
  /** Loading Neon profile after Auth0 ready */
  profileLoading: boolean;
  profileError: string | null;
  /** The session ended; the UI should offer to sign in again, not an error. */
  sessionExpired: boolean;
  login: () => void;
  logout: () => void;
  getAccessToken: (options?: {
    forceRefresh?: boolean;
  }) => Promise<string | null>;
  refreshProfile: () => Promise<void>;
  /** Convenience display label */
  displayName: string | null;
};

const UserContext = createContext<UserContextValue | null>(null);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const {
    configured,
    isLoading,
    isAuthenticated,
    user: authUser,
    login,
    logout,
    getAccessToken,
  } = useAuth();

  const [profile, setProfile] = useState<ApiUser | null>(null);
  const [portfolio, setPortfolio] = useState<ApiPortfolio | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  /** Set when the credential is dead and re-authenticating is the only fix. */
  const [sessionExpired, setSessionExpired] = useState(false);

  const refreshProfile = useCallback(async () => {
    if (!isAuthenticated) {
      setProfile(null);
      setPortfolio(null);
      setProfileError(null);
      setSessionExpired(false);
      return;
    }
    setProfileLoading(true);
    setProfileError(null);

    const load = async (forceRefresh: boolean) => {
      const token = await getAccessToken({ forceRefresh });
      if (!token) throw new ApiError("No access token", 401, "token_missing");
      return fetchMe(token);
    };

    try {
      let data;
      try {
        data = await load(false);
      } catch (err) {
        // The cached token was stale. Renew it once before giving up — this is
        // the ordinary case after an hour idle, not something worth showing.
        if (!(err instanceof ApiError) || !err.isAuthFailure) throw err;
        data = await load(true);
      }
      setProfile(data.user);
      setPortfolio(data.portfolio);
      setSessionExpired(false);
    } catch (err) {
      setProfile(null);
      setPortfolio(null);
      if (err instanceof ApiError && err.isAuthFailure) {
        // Signing in again is the fix, so say that rather than echoing the
        // API. The raw message stays in the console for debugging.
        setSessionExpired(true);
        setProfileError(null);
      } else {
        setSessionExpired(false);
        setProfileError(
          err instanceof Error ? err.message : "Failed to load profile",
        );
      }
    } finally {
      setProfileLoading(false);
    }
  }, [isAuthenticated, getAccessToken]);

  useEffect(() => {
    if (isLoading) return;
    // refreshProfile flips into its loading state before awaiting — the
    // standard fetch-in-an-effect shape, not a cascading render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshProfile();
  }, [isLoading, isAuthenticated, refreshProfile]);

  const value = useMemo<UserContextValue>(
    () => ({
      configured,
      isLoading: isLoading || (isAuthenticated && profileLoading),
      isAuthenticated,
      auth: authUser
        ? {
            sub: authUser.sub,
            name: authUser.name,
            email: authUser.email,
            picture: authUser.picture,
          }
        : null,
      profile,
      portfolio,
      profileLoading,
      profileError,
      sessionExpired,
      login,
      logout,
      getAccessToken,
      refreshProfile,
      displayName:
        profile?.display_name || authUser?.name || authUser?.email || null,
    }),
    [
      configured,
      isLoading,
      isAuthenticated,
      authUser,
      profile,
      portfolio,
      profileLoading,
      profileError,
      sessionExpired,
      login,
      logout,
      getAccessToken,
      refreshProfile,
    ],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

export const useUser = () => {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within UserProvider");
  return ctx;
};
