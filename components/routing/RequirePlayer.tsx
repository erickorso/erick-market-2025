import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useLeague } from "../../context/LeagueContext";
import { useI18n } from "../../context/I18nContext";

const RequirePlayer: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { player } = useLeague();
  const location = useLocation();
  const { t } = useI18n();

  if (!player) {
    return (
      <div className="mx-auto max-w-lg p-6 text-center">
        <h1 className="mb-2 text-2xl font-bold text-teal-700 dark:text-teal-400">
          {t("privateGames")}
        </h1>
        <p className="mb-4 text-sm text-slate-600 dark:text-gray-400">{t("privateGamesBody")}</p>
        <Link
          to="/league"
          state={{ from: location.pathname }}
          className="inline-block rounded-lg bg-teal-700 px-4 py-2 font-semibold text-white hover:bg-teal-800"
        >
          {t("joinToPlay")} →
        </Link>
      </div>
    );
  }

  return <>{children}</>;
};

export default RequirePlayer;
