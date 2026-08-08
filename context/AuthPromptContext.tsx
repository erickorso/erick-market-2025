import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { useUser } from "./UserContext";

/** Why we are asking, so the dialog can explain itself. */
export type AuthPromptReason = "trade" | "league" | "sessionExpired";

type AuthPromptValue = {
  /** The open request, or null when nothing is being asked. */
  reason: AuthPromptReason | null;
  /** Ask the user whether they want to sign in. Never redirects on its own. */
  requestLogin: (reason: AuthPromptReason) => void;
  /** They said yes — hand off to Auth0. */
  confirm: () => void;
  /** They said no, or pressed Escape. */
  dismiss: () => void;
};

const AuthPromptContext = createContext<AuthPromptValue | null>(null);

/**
 * Sending someone to Auth0 the instant they click Buy throws them out of the
 * app mid-task with no warning and no way back if they change their mind.
 * Every auth-gated action routes through here instead, so leaving is always
 * the user's decision.
 */
export const AuthPromptProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { login } = useUser();
  const [reason, setReason] = useState<AuthPromptReason | null>(null);

  const requestLogin = useCallback((next: AuthPromptReason) => {
    setReason(next);
  }, []);

  const dismiss = useCallback(() => setReason(null), []);

  const confirm = useCallback(() => {
    setReason(null);
    login();
  }, [login]);

  const value = useMemo(
    () => ({ reason, requestLogin, confirm, dismiss }),
    [reason, requestLogin, confirm, dismiss],
  );

  return (
    <AuthPromptContext.Provider value={value}>
      {children}
    </AuthPromptContext.Provider>
  );
};

export const useAuthPrompt = () => {
  const ctx = useContext(AuthPromptContext);
  if (!ctx) {
    throw new Error("useAuthPrompt must be used within AuthPromptProvider");
  }
  return ctx;
};
