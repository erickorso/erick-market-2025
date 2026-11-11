import { useMemo, useSyncExternalStore } from "react";
import { getWatchlist, subscribeWatchlist } from "../services/localWatchlist";

/** JSON of the saved list: a string, so an unchanged list compares equal. */
const snapshot = () => JSON.stringify(getWatchlist());

/**
 * The saved watchlist, re-rendering on every add or remove from anywhere in
 * the app (a star on the grid, in the detail modal, or the Watchlist page).
 *
 * getWatchlist() builds a new array on each call, which useSyncExternalStore
 * would read as a change every time and loop on, hence the string snapshot.
 */
export function useWatchlist(): string[] {
  const json = useSyncExternalStore(subscribeWatchlist, snapshot);
  return useMemo(() => JSON.parse(json) as string[], [json]);
}
