import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useStockContext } from "./StockContext";
import { useUser } from "./UserContext";
import { computeEquity, currentMonthKey } from "../services/leagueService";
import {
  fetchLeagueBoard,
  postLeagueScore,
} from "../services/portfolioApi";
import type { LeagueEntry } from "../services/leagueService";

type LeagueContextValue = {
  player: { id: string; name: string } | null;
  month: string;
  entries: LeagueEntry[];
  previousWinner: LeagueEntry | null;
  mode: "shared" | "local" | "ephemeral";
  equity: ReturnType<typeof computeEquity>;
  refresh: () => Promise<void>;
  pushScore: () => Promise<void>;
};

const LeagueContext = createContext<LeagueContextValue | null>(null);

export const LeagueProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { state } = useStockContext();
  const { isAuthenticated, auth, getAccessToken, profile, displayName } =
    useUser();
  const [month] = useState(() => currentMonthKey());
  const [entries, setEntries] = useState<LeagueEntry[]>([]);
  const [previousWinner, setPreviousWinner] = useState<LeagueEntry | null>(
    null,
  );
  const [mode, setMode] = useState<"shared" | "local" | "ephemeral">("shared");

  const equity = useMemo(
    () => computeEquity(state.fund, state.portfolio, state.allStocks),
    [state.fund, state.portfolio, state.allStocks],
  );

  const player = useMemo(() => {
    if (!isAuthenticated) return null;
    return {
      id: profile?.id || auth?.sub || "me",
      name: displayName || auth?.email || "Trader",
    };
  }, [isAuthenticated, profile, auth, displayName]);

  const refresh = useCallback(async () => {
    try {
      const board = await fetchLeagueBoard(month);
      setEntries(board.entries);
      setPreviousWinner(
        board.previousWinner
          ? {
              playerId: board.previousWinner.playerId,
              name: board.previousWinner.name,
              month: month,
              equity: board.previousWinner.equity,
              cash: 0,
              invested: 0,
              pnl: 0,
              pnlPercent: board.previousWinner.pnlPercent,
              updatedAt: new Date().toISOString(),
            }
          : null,
      );
      setMode(board.mode === "shared" ? "shared" : "ephemeral");
    } catch {
      setEntries([]);
      setMode("local");
    }
  }, [month]);

  const pushScore = useCallback(async () => {
    if (!isAuthenticated) return;
    const token = await getAccessToken();
    if (!token) return;
    await postLeagueScore(token, {
      equity: equity.equity,
      cash: equity.cash,
      invested: equity.invested,
      pnl: equity.pnl,
      pnlPercent: equity.pnlPercent,
    });
    await refresh();
  }, [isAuthenticated, getAccessToken, equity, refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!isAuthenticated || state.isLoading) return;
    const id = window.setTimeout(() => {
      void pushScore();
    }, 1000);
    return () => window.clearTimeout(id);
  }, [
    isAuthenticated,
    state.fund,
    state.portfolio,
    state.allStocks,
    state.isLoading,
    pushScore,
  ]);

  const value = useMemo(
    () => ({
      player,
      month,
      entries,
      previousWinner,
      mode,
      equity,
      refresh,
      pushScore,
    }),
    [player, month, entries, previousWinner, mode, equity, refresh, pushScore],
  );

  return (
    <LeagueContext.Provider value={value}>{children}</LeagueContext.Provider>
  );
};

export const useLeague = () => {
  const ctx = useContext(LeagueContext);
  if (!ctx) throw new Error("useLeague must be used within LeagueProvider");
  return ctx;
};
