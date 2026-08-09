import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useStockContext } from "./StockContext";
import { useUser } from "./UserContext";
import { computeEquity, currentMonthKey } from "../services/leagueService";
import { fetchLeagueBoard, postLeagueScore } from "../services/portfolioApi";
import type { LeagueEntry } from "../services/leagueService";

type LeagueContextValue = {
  player: { id: string; name: string } | null;
  month: string;
  entries: LeagueEntry[];
  previousWinner: LeagueEntry | null;
  mode: "shared" | "local" | "ephemeral";
  /** Symbols the server could not price, so the rank on screen is not current. */
  unpriced: string[];
  equity: ReturnType<typeof computeEquity>;
  refresh: () => Promise<void>;
  pushScore: () => Promise<void>;
};

const LeagueContext = createContext<LeagueContextValue | null>(null);

/** How often a mark-to-market score is republished with no trade involved. */
const LIVE_SCORE_INTERVAL_MS = 60_000;

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
  const [unpriced, setUnpriced] = useState<string[]>([]);

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
      // Coerce the numbers: the board is rendered with .toFixed(), so a field
      // the API ever omits would take the whole page down.
      setPreviousWinner(
        board.previousWinner
          ? {
              playerId: board.previousWinner.playerId,
              name: board.previousWinner.name,
              month: month,
              equity: Number(board.previousWinner.equity) || 0,
              cash: 0,
              invested: 0,
              pnl: 0,
              pnlPercent: Number(board.previousWinner.pnlPercent) || 0,
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

  // Equity is recomputed on every price tick. Reading it through a ref keeps
  // pushScore's identity stable, so the effects below fire on what actually
  // happened rather than on the clock.
  const equityRef = useRef(equity);
  useEffect(() => {
    equityRef.current = equity;
  }, [equity]);

  const pushScore = useCallback(async () => {
    if (!isAuthenticated) return;
    const token = await getAccessToken();
    if (!token) return;
    const current = equityRef.current;
    const result = await postLeagueScore(token, {
      equity: current.equity,
      cash: current.cash,
      invested: current.invested,
      pnl: current.pnl,
      pnlPercent: current.pnlPercent,
    });
    // Refusing to publish a rank it cannot price is only half the job. A rank
    // that quietly stops moving looks like a bug in the app, or worse, is
    // believed.
    setUnpriced(result.published ? [] : (result.unpriced ?? []));
    await refresh();
  }, [isAuthenticated, getAccessToken, refresh]);

  useEffect(() => {
    // Loads the board on mount; the state it sets lands in a promise callback,
    // not synchronously in the render pass.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  // A trade changes the standings, so publish it. `state.allStocks` used to be
  // a dependency here, which meant every price tick posted a score and then
  // re-fetched the board — a burst of writes for a ranking nobody was reading
  // that fast.
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
    state.isLoading,
    pushScore,
  ]);

  // The ranking is still mark-to-market: prices move it without any trade, so
  // it republishes on a fixed cadence instead of chasing the tick.
  useEffect(() => {
    if (!isAuthenticated) return;
    const id = window.setInterval(() => {
      void pushScore();
    }, LIVE_SCORE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [isAuthenticated, pushScore]);

  const value = useMemo(
    () => ({
      player,
      month,
      entries,
      previousWinner,
      mode,
      unpriced,
      equity,
      refresh,
      pushScore,
    }),
    [
      player,
      month,
      entries,
      previousWinner,
      mode,
      unpriced,
      equity,
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
