import { getSql } from "./db.js";

/**
 * Exactly-once for POST /api/trade.
 *
 * Retries elsewhere replay only errors that prove nothing was written. A
 * dropped connection proves nothing: the trade may have committed, and the
 * user who presses Buy again cannot know. A caller-supplied key, held for the
 * whole intention rather than one attempt, is what ties the two together.
 */

export type ClaimResult =
  { replayed: true; response: unknown } | { replayed: false };

/** Claims older than this are purged; long past any client still retrying. */
const KEY_TTL = "24 hours";

/** Format-checked before it reaches SQL, and bounded so it cannot be abused
 *  as arbitrary storage. */
export function parseIdempotencyKey(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const key = raw.trim();
  if (key.length < 8 || key.length > 128) return null;
  return /^[A-Za-z0-9_-]+$/.test(key) ? key : null;
}

/**
 * The INSERT is the lock: whoever wins the race executes, everyone else is told
 * what happened rather than allowed to trade again. The purge rides along in
 * the same statement — a background job for one DELETE is more moving parts
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
    // Genuinely still running. Turning the duplicate away is the whole point:
    // letting it through is the failure this exists to prevent.
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
