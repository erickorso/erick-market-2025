import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useLeague } from "../context/LeagueContext";
import { INITIAL_FUND_AMOUNT } from "../constants";

const LeaguePage: React.FC = () => {
  const {
    player,
    month,
    entries,
    previousWinner,
    mode,
    equity,
    joining,
    join,
    logout,
    pushScore,
  } = useLeague();
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await join(name, pin);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Join failed");
    }
  };

  const modeLabel =
    mode === "shared"
      ? "Shared board (Upstash)"
      : mode === "ephemeral"
        ? "Server ephemeral + local backup"
        : "This device (local)";

  return (
    <div className="relative z-10 mx-auto max-w-3xl p-4 sm:p-6">
      <h1 className="mb-2 text-3xl font-bold text-teal-400 sm:text-4xl">
        Monthly training league
      </h1>
      <p className="mb-6 text-sm text-gray-400">
        Month <span className="text-gray-200">{month}</span> · everyone starts with $
        {INITIAL_FUND_AMOUNT.toLocaleString()}. Buy/sell with live quotes. Highest
        equity at month end wins — then a fresh month begins. Demo / training only.
      </p>

      {previousWinner && (
        <div className="mb-6 rounded-xl border border-amber-500/40 bg-amber-950/30 p-4">
          <p className="text-xs uppercase tracking-wide text-amber-400">
            Last month winner
          </p>
          <p className="text-lg font-semibold text-amber-100">
            {previousWinner.name}{" "}
            <span className="text-sm font-normal text-amber-200/80">
              · ${previousWinner.equity.toFixed(2)} (
              {previousWinner.pnlPercent >= 0 ? "+" : ""}
              {previousWinner.pnlPercent.toFixed(2)}%)
            </span>
          </p>
        </div>
      )}

      {!player ? (
        <form
          onSubmit={onJoin}
          className="mb-8 space-y-4 rounded-xl border border-gray-700 bg-gray-800/80 p-5"
        >
          <h2 className="text-lg font-semibold text-gray-100">Join this month</h2>
          <p className="text-xs text-gray-500">
            Nickname + PIN (4–6 digits). Not bank-grade auth — enough to keep your
            seat on the board.
          </p>
          <label className="block text-sm text-gray-300">
            Display name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-gray-100"
              maxLength={24}
              required
              autoComplete="username"
            />
          </label>
          <label className="block text-sm text-gray-300">
            PIN
            <input
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="mt-1 w-full rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-gray-100"
              inputMode="numeric"
              pattern="\d{4,6}"
              required
              autoComplete="current-password"
            />
          </label>
          {error && <p className="text-sm text-rose-400">{error}</p>}
          <button
            type="submit"
            disabled={joining}
            className="rounded-lg bg-teal-500 px-4 py-2 font-semibold text-white hover:bg-teal-600 disabled:opacity-60"
          >
            {joining ? "Joining…" : "Join league"}
          </button>
        </form>
      ) : (
        <div className="mb-8 rounded-xl border border-gray-700 bg-gray-800/80 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">You</p>
              <p className="text-xl font-semibold text-teal-300">{player.name}</p>
              <p className="mt-2 text-sm text-gray-300">
                Equity{" "}
                <span className="font-semibold text-gray-100">
                  ${equity.equity.toFixed(2)}
                </span>{" "}
                <span
                  className={
                    equity.pnl >= 0 ? "text-emerald-400" : "text-rose-400"
                  }
                >
                  ({equity.pnl >= 0 ? "+" : ""}
                  {equity.pnlPercent.toFixed(2)}%)
                </span>
              </p>
              <p className="text-xs text-gray-500">
                Cash ${equity.cash.toFixed(2)} · Positions $
                {equity.invested.toFixed(2)}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => void pushScore()}
                className="rounded-md border border-teal-600 px-3 py-1.5 text-sm text-teal-300 hover:bg-teal-950"
              >
                Sync score
              </button>
              <button
                type="button"
                onClick={logout}
                className="rounded-md border border-gray-600 px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200"
              >
                Leave seat
              </button>
              <Link
                to="/"
                className="text-center text-xs text-teal-400 hover:text-teal-300"
              >
                Trade →
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-gray-700 bg-gray-800/60 p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold text-gray-100">Leaderboard</h2>
          <span className="text-[11px] text-gray-500">{modeLabel}</span>
        </div>
        {entries.length === 0 ? (
          <p className="text-sm text-gray-500">No scores yet this month.</p>
        ) : (
          <ol className="space-y-2">
            {entries.map((e, i) => (
              <li
                key={e.playerId}
                className={`flex items-center justify-between rounded-md border px-3 py-2 ${
                  player?.id === e.playerId
                    ? "border-teal-600/50 bg-teal-950/30"
                    : "border-gray-700 bg-gray-900/40"
                }`}
              >
                <div className="min-w-0">
                  <span className="mr-2 text-xs text-gray-500">{i + 1}.</span>
                  <span className="font-medium text-gray-100">{e.name}</span>
                </div>
                <div className="text-right text-sm">
                  <div className="font-semibold text-gray-100">
                    ${e.equity.toFixed(2)}
                  </div>
                  <div
                    className={
                      e.pnl >= 0 ? "text-xs text-emerald-400" : "text-xs text-rose-400"
                    }
                  >
                    {e.pnl >= 0 ? "+" : ""}
                    {e.pnlPercent.toFixed(2)}%
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
};

export default LeaguePage;
