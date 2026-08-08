import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  consoleErrorSink,
  flush,
  getSessionId,
  installGlobalErrorHandlers,
  reportError,
  reportVital,
  resetReporter,
  setErrorSink,
} from "./reporter";

const sink = vi.fn();
const sendBeacon = vi.fn<(url: string, body?: BodyInit) => boolean>(() => true);

async function beaconEvents(call = 0) {
  const blob = sendBeacon.mock.calls[call]?.[1] as Blob;
  return JSON.parse(await blob.text()).events;
}

beforeEach(() => {
  resetReporter();
  sink.mockReset();
  sendBeacon.mockReset().mockReturnValue(true);
  vi.stubGlobal("navigator", { ...navigator, sendBeacon });
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  resetReporter();
});

describe("reportError", () => {
  beforeEach(() => setErrorSink(sink));

  it("passes the message, stack and source through", () => {
    reportError(new Error("boom"), "boundary:chart");

    expect(sink).toHaveBeenCalledTimes(1);
    expect(sink.mock.calls[0][0]).toMatchObject({
      kind: "error",
      name: "boundary:chart",
      message: "boom",
    });
    expect(sink.mock.calls[0][0].stack).toBeTruthy();
  });

  it("wraps a non-Error so the sink always gets a message", () => {
    reportError("just a string", "window.error");
    expect(sink.mock.calls[0][0].message).toBe("just a string");
  });

  it("records where, when and which session", () => {
    reportError(new Error("boom"), "test");
    const event = sink.mock.calls[0][0];

    expect(event.url).toBe(window.location.href);
    expect(() => new Date(event.at).toISOString()).not.toThrow();
    expect(event.sessionId).toBe(getSessionId());
  });

  it("carries the component stack when a boundary supplies one", () => {
    reportError(new Error("boom"), "boundary:root", {
      componentStack: "\n  at StockCard",
    });

    expect(sink.mock.calls[0][0].componentStack).toContain("StockCard");
  });
});

describe("reportVital", () => {
  beforeEach(() => setErrorSink(sink));

  it("sends the metric with its rating", () => {
    reportVital({ name: "LCP", value: 1234.5678, rating: "good" });

    expect(sink.mock.calls[0][0]).toMatchObject({
      kind: "vital",
      name: "LCP",
      rating: "good",
    });
  });

  it("rounds the value, so CLS does not ship 15 decimals", () => {
    reportVital({ name: "CLS", value: 0.123456789 });
    expect(sink.mock.calls[0][0].value).toBe(0.123);
  });
});

describe("session id", () => {
  it("is stable within a session", () => {
    expect(getSessionId()).toBe(getSessionId());
  });

  it("correlates every event from one page load", () => {
    setErrorSink(sink);
    reportError(new Error("a"), "one");
    reportVital({ name: "LCP", value: 1 });

    expect(sink.mock.calls[0][0].sessionId).toBe(
      sink.mock.calls[1][0].sessionId,
    );
  });
});

describe("batching", () => {
  it("does not send immediately — it waits to batch", () => {
    reportError(new Error("boom"), "test");
    expect(sendBeacon).not.toHaveBeenCalled();
  });

  it("sends after the flush delay", async () => {
    reportError(new Error("boom"), "test");
    await vi.advanceTimersByTimeAsync(2_500);

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(await beaconEvents()).toHaveLength(1);
  });

  it("puts several events in one request", async () => {
    reportError(new Error("a"), "one");
    reportError(new Error("b"), "two");
    reportVital({ name: "LCP", value: 1 });
    await vi.advanceTimersByTimeAsync(2_500);

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(await beaconEvents()).toHaveLength(3);
  });

  it("flushes early once the batch is full", () => {
    for (let i = 0; i < 20; i++) reportError(new Error(`e${i}`), `s${i}`);
    expect(sendBeacon).toHaveBeenCalledTimes(1);
  });

  it("posts to the telemetry endpoint", () => {
    for (let i = 0; i < 20; i++) reportError(new Error(`e${i}`), `s${i}`);
    expect(sendBeacon.mock.calls[0][0]).toBe("/api/log");
  });

  it("sends nothing when there is nothing queued", () => {
    flush();
    expect(sendBeacon).not.toHaveBeenCalled();
  });
});

describe("deduplication", () => {
  it("folds a repeated error into one event with a count", async () => {
    for (let i = 0; i < 5; i++)
      reportError(new Error("same"), "boundary:chart");
    await vi.advanceTimersByTimeAsync(2_500);

    const events = await beaconEvents();
    expect(events).toHaveLength(1);
    expect(events[0].count).toBe(5);
  });

  it("keeps genuinely different errors apart", async () => {
    reportError(new Error("one"), "boundary:chart");
    reportError(new Error("two"), "boundary:chart");
    await vi.advanceTimersByTimeAsync(2_500);

    expect(await beaconEvents()).toHaveLength(2);
  });

  // A render loop can throw every frame; the drain must not carry that.
  it("caps how much one session can send", async () => {
    for (let i = 0; i < 200; i++) reportError(new Error(`e${i}`), `s${i}`);
    flush();

    const total = (
      await Promise.all(sendBeacon.mock.calls.map((_, i) => beaconEvents(i)))
    ).flat();
    expect(total.length).toBeLessThanOrEqual(50);
  });
});

describe("transport", () => {
  it("falls back to keepalive fetch when sendBeacon is unavailable", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("navigator", { ...navigator, sendBeacon: undefined });
    vi.stubGlobal("fetch", fetchMock);

    reportError(new Error("boom"), "test");
    await vi.advanceTimersByTimeAsync(2_500);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/log",
      expect.objectContaining({ method: "POST", keepalive: true }),
    );
  });

  it("falls back when sendBeacon refuses the payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    sendBeacon.mockReturnValue(false);
    vi.stubGlobal("fetch", fetchMock);

    reportError(new Error("boom"), "test");
    await vi.advanceTimersByTimeAsync(2_500);

    expect(fetchMock).toHaveBeenCalled();
  });

  it("never lets a telemetry failure surface as an error", async () => {
    sendBeacon.mockImplementation(() => {
      throw new Error("blocked by extension");
    });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    reportError(new Error("boom"), "test");
    expect(() => vi.advanceTimersByTime(2_500)).not.toThrow();
  });
});

describe("setErrorSink", () => {
  it("redirects every later event to the new sink", () => {
    setErrorSink(sink);
    reportError(new Error("boom"), "test");

    expect(sink).toHaveBeenCalledTimes(1);
    expect(sendBeacon).not.toHaveBeenCalled();
  });

  it("offers a console-only sink for environments that must not phone home", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    setErrorSink(consoleErrorSink);

    reportError(new Error("boom"), "boundary:root");

    expect(error).toHaveBeenCalledWith(
      "[client-error]",
      expect.stringContaining("boundary:root"),
    );
    expect(sendBeacon).not.toHaveBeenCalled();
  });

  it("mirrors errors to the console by default, for devtools", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    reportError(new Error("boom"), "test");

    expect(error).toHaveBeenCalled();
  });
});

describe("installGlobalErrorHandlers", () => {
  beforeEach(() => {
    installGlobalErrorHandlers();
    setErrorSink(sink);
  });

  it("reports a rejected promise nothing else caught", () => {
    window.dispatchEvent(
      Object.assign(new Event("unhandledrejection"), {
        reason: new Error("no catch"),
      }),
    );

    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "no catch",
        name: "unhandledrejection",
      }),
    );
  });

  it("reports an error thrown outside the render tree", () => {
    window.dispatchEvent(
      Object.assign(new Event("error"), { error: new Error("global boom") }),
    );

    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({ name: "window.error" }),
    );
  });

  // Otherwise the last errors of a session leave with the tab.
  it("flushes when the page is hidden", () => {
    setErrorSink(() => {});
    resetReporter();
    installGlobalErrorHandlers();

    reportError(new Error("boom"), "test");
    window.dispatchEvent(new Event("pagehide"));

    expect(sendBeacon).toHaveBeenCalled();
  });
});
