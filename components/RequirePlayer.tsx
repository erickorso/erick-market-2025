import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useLeague } from "../context/LeagueContext";

/** Gates the training/games area — market browse stays public. */
const RequirePlayer: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { player } = useLeague();
  const location = useLocation();

  if (!player) {
    return (
      <div className="mx-auto max-w-lg p-6 text-center">
        <h1 className="mb-2 text-2xl font-bold text-teal-400">Private games area</h1>
        <p className="mb-4 text-sm text-gray-400">
          Quotes, charts and Hot now are public. Buying/selling, your portfolio
          and the monthly league need a player seat (nickname + PIN).
        </p>
        <Link
          to="/league"
          state={{ from: location.pathname }}
          className="inline-block rounded-lg bg-teal-500 px-4 py-2 font-semibold text-white hover:bg-teal-600"
        >
          Join to play →
        </Link>
      </div>
    );
  }

  return <>{children}</>;
};

export default RequirePlayer;
