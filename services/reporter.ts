export type ClientEvent = {
  kind: "error" | "vital";
  /** "boundary:chart", "unhandledrejection", "LCP"… */
  name: string;
  message?: string;
  stack?: string;
  componentStack?: string;
  value?: number;
  rating?: "good" | "needs-improvement" | "poor";
  url: string;
  at: string;
  sessionId: string;
  /** Identical events folded together rather than sent one by one. */
  count?: number;
};

type Sink = (event: ClientEvent) => void;

const ENDPOINT = "/api/log";
const FLUSH_DELAY_MS = 2_000;
const MAX_BATCH = 20;
/** Per page load. A render loop can throw thousands of times; we want a few. */
const MAX_EVENTS_PER_SESSION = 50;

let sessionId = "";
let queue: ClientEvent[] = [];
let flushTimer: number | null = null;
let sentThisSession = 0;
/** name+message -> index in `queue`, so a repeat increments instead of appending. */
const seen = new Map<string, number>();

/** Groups one browsing session's events. Random, stored nowhere, identifies nobody. */
export function getSessionId(): string {
  if (!sessionId) {
    sessionId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
  return sessionId;
}

/**
 * Ships a batch to the API. `sendBeacon` survives the page being closed, which
 * is exactly when the interesting errors happen; `fetch(keepalive)` covers
 * browsers without it.
 */
function post(events: ClientEvent[]) {
  if (events.length === 0 || typeof window === "undefined") return;
  const body = JSON.stringify({ events });

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon(ENDPOINT, blob)) return;
    }
    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {
      /* telemetry must never surface as an error of its own */
    });
  } catch {
    /* likewise */
  }
}

export function flush() {
  if (flushTimer !== null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  const batch = queue;
  queue = [];
  seen.clear();
  post(batch);
}

function enqueue(event: ClientEvent) {
  if (sentThisSession >= MAX_EVENTS_PER_SESSION) return;

  // Fold repeats: a broken render can throw the same error every frame.
  const key = `${event.kind}:${event.name}:${event.message ?? ""}`;
  const at = seen.get(key);
  if (at !== undefined && queue[at]) {
    queue[at].count = (queue[at].count ?? 1) + 1;
    return;
  }

  sentThisSession += 1;
  seen.set(key, queue.push({ ...event, count: 1 }) - 1);

  if (queue.length >= MAX_BATCH) {
    flush();
    return;
  }
  if (flushTimer === null && typeof window !== "undefined") {
    flushTimer = window.setTimeout(flush, FLUSH_DELAY_MS);
  }
}

/** Default destination: batched to /api/log, plus a console line for devtools. */
export const defaultSink: Sink = (event) => {
  if (event.kind === "error") console.error("[client-error]", JSON.stringify(event));
  enqueue(event);
};

/** Console only. Used by tests and anything that must not touch the network. */
export const consoleErrorSink: Sink = (event) => {
  console.error("[client-error]", JSON.stringify(event));
};

let sink: Sink = defaultSink;

/**
 * Swap the destination. `setErrorSink(e => Sentry.captureException(e))` in
 * index.tsx is the whole integration — no call site changes.
 */
export function setErrorSink(next: Sink) {
  sink = next;
}

function baseEvent(): Pick<ClientEvent, "url" | "at" | "sessionId"> {
  return {
    url: typeof window === "undefined" ? "" : window.location.href,
    at: new Date().toISOString(),
    sessionId: getSessionId(),
  };
}

export function reportError(
  error: unknown,
  source: string,
  extra: { componentStack?: string } = {},
) {
  const err = error instanceof Error ? error : new Error(String(error));
  sink({
    kind: "error",
    name: source,
    message: err.message,
    stack: err.stack,
    componentStack: extra.componentStack,
    ...baseEvent(),
  });
}

export function reportVital(vital: {
  name: string;
  value: number;
  rating?: ClientEvent["rating"];
}) {
  sink({
    kind: "vital",
    name: vital.name,
    value: Math.round(vital.value * 1000) / 1000,
    rating: vital.rating,
    ...baseEvent(),
  });
}

/** Test seam — module state survives between cases otherwise. */
export function resetReporter() {
  queue = [];
  seen.clear();
  sentThisSession = 0;
  sessionId = "";
  if (flushTimer !== null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  sink = defaultSink;
}

/**
 * Catches what React boundaries cannot: rejected promises and errors thrown
 * outside the render tree. Also flushes on the way out, so the last errors of
 * a session are not lost with the tab.
 */
export function installGlobalErrorHandlers() {
  if (typeof window === "undefined") return;

  window.addEventListener("unhandledrejection", (event) => {
    reportError(event.reason, "unhandledrejection");
  });

  window.addEventListener("error", (event) => {
    reportError(event.error ?? event.message, "window.error");
  });

  // pagehide fires on bfcache navigations where unload does not.
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
}
