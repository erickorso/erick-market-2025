import React from "react";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";

const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { configured, isLoading, isAuthenticated, login } = useAuth();
  const { t } = useI18n();

  if (isLoading) {
    return (
      <div className="p-8 text-center text-gray-400" role="status">
        {t("loading")}
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-lg p-6 text-center">
        <h1 className="mb-2 text-2xl font-bold text-teal-400">
          {t("loginRequiredTitle")}
        </h1>
        <p className="mb-4 text-sm text-gray-400">
          {configured ? t("loginRequiredBody") : t("authNotConfigured")}
        </p>
        <button
          type="button"
          onClick={login}
          className="inline-block rounded-lg bg-teal-500 px-4 py-2 font-semibold text-white hover:bg-teal-600"
        >
          {t("login")}
        </button>
      </div>
    );
  }

  return <>{children}</>;
};

export default RequireAuth;
