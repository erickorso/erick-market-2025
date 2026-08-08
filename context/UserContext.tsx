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
  login: () => void;
  logout: () => void;
  getAccessToken: () => Promise<string | null>;
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

  const refreshProfile = useCallback(async () => {
    if (!isAuthenticated) {
      setProfile(null);
      setPortfolio(null);
      setProfileError(null);
      return;
    }
    setProfileLoading(true);
    setProfileError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("No access token");
      const data = await fetchMe(token);
      setProfile(data.user);
      setPortfolio(data.portfolio);
    } catch (err) {
      setProfile(null);
      setPortfolio(null);
      setProfileError(
        err instanceof Error ? err.message : "Failed to load profile",
      );
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
