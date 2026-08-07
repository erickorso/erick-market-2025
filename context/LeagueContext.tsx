import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useStockContext } from "./StockContext";
import {
  archiveLocalMonth,
  computeEquity,
  currentMonthKey,
  fetchLeagueBoard,
  joinLeague,
  loadPlayer,
  clearPlayer,
  previousMonthKey,
  submitLeagueScore,
  type LeagueEntry,
  type LeaguePlayer,
} from "../services/leagueService";
import { INITIAL_FUND_AMOUNT } from "../constants";

type LeagueContextValue = {
  player: LeaguePlayer | null;
  month: string;
  entries: LeagueEntry[];
  previousWinner: LeagueEntry | null;
  mode: "shared" | "local" | "ephemeral";
  equity: ReturnType<typeof computeEquity>;
  joining: boolean;
  join: (name: string, pin: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
  pushScore: () => Promise<void>;
};

const LeagueContext = createContext<LeagueContextValue | null>(null);

export const LeagueProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { state, dispatch } = useStockContext();
  const [player, setPlayer] = useState<LeaguePlayer | null>(() => loadPlayer());
  const [month] = useState(() => currentMonthKey());
  const [entries, setEntries] = useState<LeagueEntry[]>([]);
  const [previousWinner, setPreviousWinner] = useState<LeagueEntry | null>(null);
  const [mode, setMode] = useState<"shared" | "local" | "ephemeral">("local");
  const [joining, setJoining] = useState(false);

  const equity = useMemo(
    () => computeEquity(state.fund, state.portfolio, state.allStocks),
    [state.fund, state.portfolio, state.allStocks],
  );

  const refresh = useCallback(async () => {
    const board = await fetchLeagueBoard(month);
    setEntries(board.entries);
    setPreviousWinner(board.previousWinner);
    setMode(board.mode);
  }, [month]);

  const pushScore = useCallback(async () => {
    if (!player) return;
    const entry: LeagueEntry & { pinHash: string } = {
      playerId: player.id,
      name: player.name,
      month,
      equity: equity.equity,
      cash: equity.cash,
      invested: equity.invested,
      pnl: equity.pnl,
      pnlPercent: equity.pnlPercent,
      updatedAt: new Date().toISOString(),
      pinHash: player.pinHash,
    };
    await submitLeagueScore(entry);
    await refresh();
  }, [player, month, equity, refresh]);

  const join = useCallback(
    async (name: string, pin: string) => {
      setJoining(true);
      try {
        const p = await joinLeague(name, pin);
        setPlayer(p);
        dispatch({
          type: "SET_NOTICE",
          payload: {
            type: "success",
            message: `Joined monthly training as ${p.name}. Start fund $${INITIAL_FUND_AMOUNT}.`,
          },
        });
        await refresh();
      } finally {
        setJoining(false);
      }
    },
    [dispatch, refresh],
  );

  const logout = useCallback(() => {
    clearPlayer();
    setPlayer(null);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Push score when portfolio changes (debounced)
  useEffect(() => {
    if (!player || state.isLoading) return;
    const id = window.setTimeout(() => {
      void pushScore();
    }, 800);
    return () => window.clearTimeout(id);
  }, [
    player,
    state.fund,
    state.portfolio,
    state.allStocks,
    state.isLoading,
    pushScore,
  ]);

  // Soft-close previous month locally once per session when we see an archive gap
  useEffect(() => {
    const prev = previousMonthKey();
    try {
      const flag = sessionStorage.getItem(`league-archived-${prev}`);
      if (flag) return;
      archiveLocalMonth(prev);
      sessionStorage.setItem(`league-archived-${prev}`, "1");
      void refresh();
    } catch {
      /* ignore */
    }
  }, [refresh]);

  const value = useMemo(
    () => ({
      player,
      month,
      entries,
      previousWinner,
      mode,
      equity,
      joining,
      join,
      logout,
      refresh,
      pushScore,
    }),
    [
      player,
      month,
      entries,
      previousWinner,
      mode,
      equity,
      joining,
      join,
      logout,
      refresh,
      pushScore,
    ],
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
