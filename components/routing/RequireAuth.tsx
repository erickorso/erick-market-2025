import React from "react";
import { useLocation } from "react-router-dom";
import { useUser } from "../../context/UserContext";
import { useI18n } from "../../context/I18nContext";

/**
 * Client route middleware: blocks private pages until Auth0 session exists.
 * Use as element wrapper or via `protectedRoute(<Page />)`.
 */
export const RequireAuth: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const {
    configured,
    isLoading,
    isAuthenticated,
    login,
    profileError,
    sessionExpired,
  } = useUser();
  const { t } = useI18n();
  const location = useLocation();

  if (isLoading) {
    return (
      <div
        className="p-8 text-center text-slate-600 dark:text-gray-400"
        role="status"
      >
        {t("loading")}
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-lg p-6 text-center">
        <h1 className="mb-2 text-2xl font-bold text-teal-700 dark:text-teal-400">
          {t("loginRequiredTitle")}
        </h1>
        <p className="mb-4 text-sm text-slate-600 dark:text-gray-400">
          {configured ? t("loginRequiredBody") : t("authNotConfigured")}
        </p>
        <button
          type="button"
          onClick={login}
          className="inline-block rounded-lg bg-teal-700 px-4 py-2 font-semibold text-white hover:bg-teal-800"
        >
          {t("login")}
        </button>
        <p className="mt-3 text-[11px] text-slate-600 dark:text-gray-400">
          {location.pathname}
        </p>
      </div>
    );
  }

  // An expired credential is an ordinary end-of-session, not a failure. It
  // gets its own copy so the user is told what happened and what to do,
  // instead of reading the JWT library's wording.
  if (sessionExpired) {
    return (
      <div className="mx-auto max-w-lg p-6 text-center">
        <h1 className="mb-2 text-xl font-bold text-slate-900 dark:text-gray-100">
          {t("sessionExpiredTitle")}
        </h1>
        <p className="mb-4 text-sm text-slate-600 dark:text-gray-400">
          {t("sessionExpiredBody")}
        </p>
        <button
          type="button"
          onClick={login}
          className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
        >
          {t("signInAgain")}
        </button>
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="mx-auto max-w-lg p-6 text-center">
        <h1 className="mb-2 text-xl font-bold text-rose-600 dark:text-rose-400">
          {t("error")}
        </h1>
        <p className="mb-4 text-sm text-slate-600 dark:text-gray-400">
          {profileError}
        </p>
        <button
          type="button"
          onClick={login}
          className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
        >
          {t("login")}
        </button>
      </div>
    );
  }

  return <>{children}</>;
};

/** Helper for Routes config */
export function protectedRoute(element: React.ReactNode) {
  return <RequireAuth>{element}</RequireAuth>;
}

export default RequireAuth;
