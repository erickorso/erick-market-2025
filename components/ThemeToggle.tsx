import React from "react";
import { useTheme } from "../context/ThemeContext";
import { useI18n } from "../context/I18nContext";

/** Sun / moon toggle for the header (top-left). */
const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const { t } = useI18n();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:border-teal-500 hover:text-teal-600 dark:border-gray-600 dark:bg-gray-800 dark:text-amber-300 dark:hover:border-teal-500 dark:hover:text-teal-300"
      aria-label={isDark ? t("themeToLight") : t("themeToDark")}
      title={isDark ? t("themeToLight") : t("themeToDark")}
    >
      {isDark ? (
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden
        >
          <path d="M21 14.5A8.5 8.5 0 0 1 9.5 3 7 7 0 1 0 21 14.5z" />
        </svg>
      )}
    </button>
  );
};

export default ThemeToggle;
