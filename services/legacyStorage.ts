/**
 * Keys left behind by the old PIN-based local league, removed in favour of
 * the Auth0 league. `player.v1` held a SHA-256 of the player's PIN with a
 * fixed salt — trivially reversible for a 4–6 digit PIN — so it should not
 * sit in a browser for ever just because the code that wrote it is gone.
 */
export const LEGACY_KEYS = [
  "erick-market.player.v1",
  "erick-market.league.v1",
] as const;

/** Deletes the legacy keys. Safe to run on every start; storage may be off. */
export function clearLegacyStorage(): void {
  try {
    for (const key of LEGACY_KEYS) localStorage.removeItem(key);
  } catch {
    /* storage disabled (private mode): nothing was stored either */
  }
}
