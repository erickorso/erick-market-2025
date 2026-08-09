import { getSql } from "./db.js";

/**
 * Exactly-once for a write endpoint.
 *
 * The retry logic elsewhere in this codebase is careful to replay only errors
 * that prove nothing was written. That covers the errors the server chose to
 * return; it cannot cover the ones it never got to send. If the connection
 * drops after the trade commits, the user sees a failure, presses Buy again,
 * and buys twice — and no amount of guarding in the UI can prevent it, because
 * the first request already finished.
 *
 * A key supplied by the caller is the only thing that ties those two requests
 * together. It is generated per *intention*, not per attempt: every replay of
 * one Buy carries the same key, and a new Buy carries a new one.
 */

export type ReplayHit = { replayed: true; response: unknown };
export type ClaimResult = ReplayHit | { replayed: false };

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
 * is the one who executes. Everyone else either replays a stored response or —
 * if the winner has not finished yet — is turned away rather than let through,
 * because letting a duplicate proceed is the exact failure this prevents.
 */
export async function claim(userId: string, key: string): Promise<ClaimResult> {
  const sql = getSql();
  const inserted = await sql`
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
  if (response === null) {
    throw Object.assign(new Error("That trade is already being processed"), {
      status: 409,
      code: "trade_in_progress",
    });
  }
  return { replayed: true, response };
}

/** Stores the answer so a later replay of the same key returns it verbatim. */
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
 * are entitled to retake. Only a trade that actually ran keeps its key.
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
