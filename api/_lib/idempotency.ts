import { getSql } from "./db.js";

/**
 * Exactly-once for a write endpoint.
 *
 * The retry logic elsewhere in this codebase replays only errors that prove
 * nothing was written. That covers the errors the server chose to return; it
 * cannot cover the ones it never got to send. If the connection drops after the
 * trade commits, the user sees a failure, presses Buy again, and buys twice —
 * and no amount of guarding in the UI can prevent it, because the first request
 * already finished.
 *
 * A key supplied by the caller is the only thing that ties those two requests
 * together. It is generated per *intention*, not per attempt: every replay of
 * one Buy carries the same key, and a new Buy carries a new one.
 */

export type ClaimResult =
  { replayed: true; response: unknown } | { replayed: false };

/** Claims older than this are purged; long past any client still retrying. */
const KEY_TTL = "24 hours";

/**
 * Past this, a claim with no trade behind it cannot still be running — the
 * function that made it dies at its own timeout, orders of magnitude sooner.
 * Without this the hole the ledger cannot cover stays open forever: a request
 * that claims a key and dies before trading leaves that key unusable, and
 * since the key belongs to the order, the user is stuck on 409 until they
 * change the order itself.
 */
const ORPHAN_AFTER = "5 minutes";

/** Format-checked before it reaches SQL, and bounded so it cannot be abused
 *  as arbitrary storage. */
export function parseIdempotencyKey(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const key = raw.trim();
  if (key.length < 8 || key.length > 128) return null;
  return /^[A-Za-z0-9_-]+$/.test(key) ? key : null;
}

/**
 * Reserves the key, or reports what to do instead.
 *
 * The INSERT is the lock: `ON CONFLICT DO NOTHING` means whoever wins the race
 * executes, and everyone else has to be told what happened rather than allowed
 * to trade again.
 *
 * The purge rides along in the same statement so expiring old keys costs no
 * extra round trip — a background job for one DELETE would be more moving parts
 * than the problem deserves.
 */
export async function claim(userId: string, key: string): Promise<ClaimResult> {
  const sql = getSql();
  const inserted = await sql`
    WITH purged AS (
      DELETE FROM trade_requests
      WHERE created_at < now() - ${KEY_TTL}::interval
    )
    INSERT INTO trade_requests (user_id, idempotency_key)
    VALUES (${userId}, ${key})
    ON CONFLICT (user_id, idempotency_key) DO NOTHING
    RETURNING idempotency_key
  `;
  if (inserted.length) return { replayed: false };

  const existing = await sql`
    SELECT response FROM trade_requests
    WHERE user_id = ${userId} AND idempotency_key = ${key}
  `;
  const response = existing[0]?.response ?? null;
  if (response !== null) return { replayed: true, response };

  // No response yet, which is ambiguous: the winner may still be running, or it
  // may have committed and died before writing one. The ledger settles it —
  // the trade row carries the key and was written in the same statement as the
  // trade itself, so its presence is proof the trade happened.
  return recoverFromLedger(userId, key);
}

async function recoverFromLedger(
  userId: string,
  key: string,
): Promise<ClaimResult> {
  const sql = getSql();
  const trade = await sql`
    SELECT id FROM trades
    WHERE user_id = ${userId} AND idempotency_key = ${key}
    LIMIT 1
  `;
  if (!trade.length) {
    // No trade under this key. Either the winner is mid-flight, or it died
    // before it got anywhere — age is the only thing that separates the two.
    const freed = await sql`
      DELETE FROM trade_requests
      WHERE user_id = ${userId}
        AND idempotency_key = ${key}
        AND response IS NULL
        AND created_at < now() - ${ORPHAN_AFTER}::interval
      RETURNING idempotency_key
    `;
    if (freed.length) {
      // Freed, so take it over rather than making the user press Buy again.
      // The insert is still the lock: if another request beat us to the
      // re-claim, it owns the execution and this one waits like any duplicate.
      const retaken = await sql`
        INSERT INTO trade_requests (user_id, idempotency_key)
        VALUES (${userId}, ${key})
        ON CONFLICT (user_id, idempotency_key) DO NOTHING
        RETURNING idempotency_key
      `;
      if (retaken.length) return { replayed: false };
    }
    // Still running. Turning the duplicate away is the whole point: letting it
    // through is the failure this exists to prevent.
    throw Object.assign(new Error("That trade is already being processed"), {
      status: 409,
      code: "trade_in_progress",
    });
  }
  // It ran. Rebuild the answer the crashed request never got to send, and cache
  // it so the next replay is a single lookup again.
  const { loadPortfolio } = await import("./store.js");
  const portfolio = await loadPortfolio(userId);
  await record(userId, key, portfolio);
  return { replayed: true, response: portfolio };
}

/** Caches the answer so a later replay of the same key returns it verbatim. */
export async function record(userId: string, key: string, response: unknown) {
  const sql = getSql();
  await sql`
    UPDATE trade_requests
    SET response = ${JSON.stringify(response)}::jsonb
    WHERE user_id = ${userId} AND idempotency_key = ${key}
  `;
}

/**
 * Frees the key when the trade did not happen.
 *
 * A rejected trade — no cash, not enough shares, no market price — wrote
 * nothing, so holding its key would strand the user on 409 for a decision they
 * are entitled to retake.
 */
export async function release(userId: string, key: string) {
  const sql = getSql();
  await sql`
    DELETE FROM trade_requests
    WHERE user_id = ${userId}
      AND idempotency_key = ${key}
      AND response IS NULL
  `;
}
