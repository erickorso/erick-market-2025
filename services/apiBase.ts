/**
 * Where the API lives.
 *
 * The web app talks to its own origin, so every path stayed relative and no
 * base was needed. A native client has no origin to be relative to — it has to
 * name the host — and hardcoding that host in each service would have meant
 * touching every call site the day it moves.
 *
 * So the base is set once at startup and read at call time. Empty by default,
 * which is exactly the relative behaviour the web already had.
 */

let base = "";

export function setApiBase(next: string) {
  base = next.replace(/\/+$/, "");
}

export function getApiBase() {
  return base;
}

/** Resolves an API path against the configured base. */
export function apiUrl(path: string) {
  return `${base}${path}`;
}

/**
 * The websocket twin. Native has no `location` to derive a scheme from, so
 * when a base is configured its scheme decides, and only the browser falls
 * back to the page's own protocol.
 */
export function wsUrl(path: string) {
  if (base) {
    return `${base.replace(/^http/, "ws")}${path}`;
  }
  const loc = globalThis.location;
  const scheme = loc?.protocol === "https:" ? "wss:" : "ws:";
  return `${scheme}//${loc?.host ?? ""}${path}`;
}
