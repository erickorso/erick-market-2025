import {
  INITIAL_FUND_AMOUNT,
  LEAGUE_API_URL,
  LEAGUE_LOCAL_KEY,
  PLAYER_KEY,
} from "../constants";
import type { EnrichedStock, PortfolioItem } from "../types";

export type LeaguePlayer = {
  id: string;
  name: string;
  pinHash: string;
};

export type LeagueEntry = {
  playerId: string;
  name: string;
  month: string;
  equity: number;
  cash: number;
  invested: number;
  pnl: number;
  pnlPercent: number;
  updatedAt: string;
};

export type MonthArchive = {
  month: string;
  winner: LeagueEntry | null;
  entries: LeagueEntry[];
};

export function currentMonthKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function previousMonthKey(d = new Date()): string {
  const x = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  return currentMonthKey(x);
}

export async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(`erick-market:${pin}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function loadPlayer(): LeaguePlayer | null {
  try {
    const raw = localStorage.getItem(PLAYER_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as LeaguePlayer;
    if (!p?.id || !p?.name || !p?.pinHash) return null;
    return p;
  } catch {
    return null;
  }
}

export function savePlayer(player: LeaguePlayer) {
  localStorage.setItem(PLAYER_KEY, JSON.stringify(player));
}

export function clearPlayer() {
  localStorage.removeItem(PLAYER_KEY);
}

export function newPlayerId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `p_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function portfolioMarketValue(
  portfolio: PortfolioItem[],
  stocks: EnrichedStock[],
): number {
  return portfolio.reduce((sum, item) => {
    const live = stocks.find(
      (s) => s.id === item.stockId || s.company === item.company,
    );
    const px = live?.price ?? item.purchasePrice;
    return sum + item.quantity * px;
  }, 0);
}

export function computeEquity(
  fund: number,
  portfolio: PortfolioItem[],
  stocks: EnrichedStock[],
) {
  const invested = portfolioMarketValue(portfolio, stocks);
  const equity = fund + invested;
  const pnl = equity - INITIAL_FUND_AMOUNT;
  const pnlPercent = (pnl / INITIAL_FUND_AMOUNT) * 100;
  return { equity, invested, cash: fund, pnl, pnlPercent };
}

type LocalLeagueStore = {
  archives: MonthArchive[];
  live: Record<string, LeagueEntry[]>;
};

function readLocalStore(): LocalLeagueStore {
  try {
    const raw = localStorage.getItem(LEAGUE_LOCAL_KEY);
    if (!raw) return { archives: [], live: {} };
    const parsed = JSON.parse(raw) as LocalLeagueStore;
    return {
      archives: Array.isArray(parsed.archives) ? parsed.archives : [],
      live: parsed.live && typeof parsed.live === "object" ? parsed.live : {},
    };
  } catch {
    return { archives: [], live: {} };
  }
}

function writeLocalStore(store: LocalLeagueStore) {
  localStorage.setItem(LEAGUE_LOCAL_KEY, JSON.stringify(store));
}

export function upsertLocalScore(entry: LeagueEntry) {
  const store = readLocalStore();
  const list = store.live[entry.month] ?? [];
  const idx = list.findIndex((e) => e.playerId === entry.playerId);
  if (idx >= 0) list[idx] = entry;
  else list.push(entry);
  list.sort((a, b) => b.equity - a.equity);
  store.live[entry.month] = list;
  writeLocalStore(store);
  return list;
}

export function archiveLocalMonth(month: string): MonthArchive {
  const store = readLocalStore();
  const entries = [...(store.live[month] ?? [])].sort(
    (a, b) => b.equity - a.equity,
  );
  const archive: MonthArchive = {
    month,
    winner: entries[0] ?? null,
    entries,
  };
  store.archives = [
    archive,
    ...store.archives.filter((a) => a.month !== month),
  ].slice(0, 24);
  delete store.live[month];
  writeLocalStore(store);
  return archive;
}

export function getLocalBoard(month: string): LeagueEntry[] {
  return [...(readLocalStore().live[month] ?? [])].sort(
    (a, b) => b.equity - a.equity,
  );
}

export function getLocalArchive(month: string): MonthArchive | null {
  return readLocalStore().archives.find((a) => a.month === month) ?? null;
}

export async function joinLeague(
  name: string,
  pin: string,
): Promise<LeaguePlayer> {
  const trimmed = name.trim().slice(0, 24);
  if (trimmed.length < 2) throw new Error("Name must be at least 2 characters");
  if (!/^\d{4,6}$/.test(pin)) throw new Error("PIN must be 4–6 digits");
  const pinHash = await hashPin(pin);
  const player: LeaguePlayer = {
    id: newPlayerId(),
    name: trimmed,
    pinHash,
  };

  try {
    const res = await fetch(LEAGUE_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "join",
        playerId: player.id,
        name: player.name,
        pinHash: player.pinHash,
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as { playerId?: string };
      if (data.playerId) player.id = data.playerId;
    }
  } catch {
    /* local-only join */
  }

  savePlayer(player);
  return player;
}

export async function submitLeagueScore(entry: LeagueEntry & { pinHash: string }) {
  upsertLocalScore(entry);
  try {
    await fetch(LEAGUE_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "score", ...entry }),
    });
  } catch {
    /* local ok */
  }
}

export async function fetchLeagueBoard(month: string): Promise<{
  mode: "shared" | "local" | "ephemeral";
  entries: LeagueEntry[];
  previousWinner: LeagueEntry | null;
}> {
  try {
    const res = await fetch(
      `${LEAGUE_API_URL}?month=${encodeURIComponent(month)}`,
    );
    if (res.ok) {
      const data = (await res.json()) as {
        mode?: string;
        entries?: LeagueEntry[];
        previousWinner?: LeagueEntry | null;
      };
      const remote = Array.isArray(data.entries) ? data.entries : [];
      const local = getLocalBoard(month);
      const merged = new Map<string, LeagueEntry>();
      for (const e of [...local, ...remote]) merged.set(e.playerId, e);
      const entries = [...merged.values()].sort((a, b) => b.equity - a.equity);
      const prev =
        data.previousWinner ??
        getLocalArchive(previousMonthKey())?.winner ??
        null;
      return {
        mode:
          data.mode === "shared"
            ? "shared"
            : data.mode === "ephemeral"
              ? "ephemeral"
              : "local",
        entries,
        previousWinner: prev,
      };
    }
  } catch {
    /* fall through */
  }
  return {
    mode: "local",
    entries: getLocalBoard(month),
    previousWinner: getLocalArchive(previousMonthKey())?.winner ?? null,
  };
}
