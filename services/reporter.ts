export type ClientErrorReport = {
  message: string;
  stack?: string;
  componentStack?: string;
  /** Which boundary or listener caught it, e.g. "boundary:chart". */
  source: string;
  url: string;
  at: string;
};

type Sink = (report: ClientErrorReport) => void;

/**
 * Where client errors go. Defaults to a structured console line, which is what
 * the browser devtools and any log forwarder can already read.
 *
 * Swap it once for a real backend — `setErrorSink(r => Sentry.captureException(r))`
 * in index.tsx — and every call site keeps working untouched.
 */
let sink: Sink = (report) => {
  console.error("[client-error]", JSON.stringify(report));
};

export function setErrorSink(next: Sink) {
  sink = next;
}

export function reportError(
  error: unknown,
  source: string,
  extra: { componentStack?: string } = {},
) {
  const err = error instanceof Error ? error : new Error(String(error));
  sink({
    message: err.message,
    stack: err.stack,
    componentStack: extra.componentStack,
    source,
    url: typeof window === "undefined" ? "" : window.location.href,
    at: new Date().toISOString(),
  });
}

/**
 * Catches what React boundaries cannot: rejected promises and errors thrown
 * outside the render tree. Call once at startup.
 */
export function installGlobalErrorHandlers() {
  if (typeof window === "undefined") return;

  window.addEventListener("unhandledrejection", (event) => {
    reportError(event.reason, "unhandledrejection");
  });

  window.addEventListener("error", (event) => {
    reportError(event.error ?? event.message, "window.error");
  });
}
