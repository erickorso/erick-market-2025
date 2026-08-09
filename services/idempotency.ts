/**
 * One key per trade intention.
 *
 * `crypto.randomUUID` needs a secure context, which localhost and the
 * deployed origin both are — but a key that silently fails to generate would
 * turn every trade into a 400, so the fallback exists rather than assuming.
 * It only has to be unique per user, and the server scopes keys by user id.
 */
export function newIdempotencyKey(): string {
  const uuid = globalThis.crypto?.randomUUID;
  if (typeof uuid === "function") return globalThis.crypto.randomUUID();

  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
