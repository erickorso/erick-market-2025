/**
 * The user's personal watchlist, kept in this browser's localStorage only.
 *
 * Not to be confused with data/watchlist.ts, which is the curated catalog that
 * every user sees. This list is per-device, has no server copy, and stores
 * nothing but upper-cased ticker symbols in insertion order.
 */
export const WATCHLIST_STORAGE_KEY = "erick-market.watchlist";

const listeners = new Set<() => void>();

/**
 * Calls `listener` after every add or remove, so several views of the same
 * symbol (a grid card and the detail modal over it) stay in step — and when
 * another tab changes the list: the browser fires `storage` in every other
 * tab of the origin, never in the one that wrote. A null key is a clear().
 * Returns the unsubscribe function — the shape useSyncExternalStore expects.
 */
export function subscribeWatchlist(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === WATCHLIST_STORAGE_KEY || event.key === null) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function normalize(symbol: string): string {
  return symbol.trim().toUpperCase();
}

/** Saved symbols. Missing, corrupt or unreadable storage reads as empty. */
export function getWatchlist(): string[] {
  try {
    const raw = localStorage.getItem(WATCHLIST_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s): s is string => typeof s === "string");
  } catch {
    return [];
  }
}

/** An emptied list deletes the key rather than leaving "[]" behind. */
function save(symbols: string[]): void {
  try {
    if (symbols.length === 0) localStorage.removeItem(WATCHLIST_STORAGE_KEY);
    else localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(symbols));
  } catch {
    /* storage full or disabled (e.g. private mode) — nothing to persist to */
  }
  listeners.forEach((listener) => listener());
}

export function isInWatchlist(symbol: string): boolean {
  return getWatchlist().includes(normalize(symbol));
}

/** Adds a symbol if it is not already saved. Returns the resulting list. */
export function addToWatchlist(symbol: string): string[] {
  const normalized = normalize(symbol);
  const current = getWatchlist();
  if (!normalized || current.includes(normalized)) return current;
  const next = [...current, normalized];
  save(next);
  return next;
}

/** Removes a symbol if present. Returns the resulting list. */
export function removeFromWatchlist(symbol: string): string[] {
  const normalized = normalize(symbol);
  const next = getWatchlist().filter((s) => s !== normalized);
  save(next);
  return next;
}
