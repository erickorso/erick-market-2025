import React from "react";
import { Link } from "react-router-dom";
import { useUser } from "../../context/UserContext";
import {
  useAuthPrompt,
  type AuthPromptReason,
} from "../../context/AuthPromptContext";

type ProtectedLinkProps = {
  to: string;
  reason: AuthPromptReason;
  className?: string;
  children: React.ReactNode;
} & Omit<React.ComponentProps<typeof Link>, "to">;

/**
 * A link to a page guests cannot see. For them, clicking asks whether they
 * want to sign in rather than walking them into a dead end that only says
 * "sign in to continue".
 *
 * It stays a real anchor rather than becoming a button, so the href is still
 * there for middle-click, "open in new tab" and assistive tech — those land on
 * the guard's page, which is the right destination for a direct navigation.
 */
const ProtectedLink: React.FC<ProtectedLinkProps> = ({
  to,
  reason,
  children,
  onClick,
  ...rest
}) => {
  const { isAuthenticated } = useUser();
  const { requestLogin } = useAuthPrompt();

  return (
    <Link
      to={to}
      onClick={(e) => {
        onClick?.(e);
        // Let modified clicks through: the user asked for a new tab.
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
        if (!isAuthenticated) {
          e.preventDefault();
          requestLogin(reason);
        }
      }}
      {...rest}
    >
      {children}
    </Link>
  );
};

export default ProtectedLink;
