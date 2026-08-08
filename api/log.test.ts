import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import handler from "./log";

function req(over: Partial<VercelRequest> = {}): VercelRequest {
  return {
    method: "POST",
    url: "/api/log",
    headers: {
      "x-forwarded-for": `203.0.113.${Math.floor(Math.random() * 250)}`,
    },
    body: {
      events: [{ kind: "error", name: "boundary:chart", message: "boom" }],
    },
    ...over,
  } as unknown as VercelRequest;
}

function res() {
  const headers: Record<string, string> = {};
  const spy = {
    statusCode: 200,
    setHeader: (k: string, v: string) => {
      headers[k] = v;
    },
    status: vi.fn(function (code: number) {
      spy.statusCode = code;
      return spy;
    }),
    json: vi.fn(() => spy),
    end: vi.fn(() => spy),
  };
  return { res: spy as unknown as VercelResponse, headers, spy };
}

function logged(spyFn: ReturnType<typeof vi.spyOn>) {
  return spyFn.mock.calls.map(([line]) => JSON.parse(line as string));
}

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("method handling", () => {
  it("answers preflight", () => {
    const { res: r, spy } = res();
    handler(req({ method: "OPTIONS" }), r);

    expect(spy.status).toHaveBeenCalledWith(204);
  });

  it("refuses anything but POST", () => {
    const { res: r, spy } = res();
    handler(req({ method: "GET" }), r);

    expect(spy.status).toHaveBeenCalledWith(405);
  });

  it("answers 204 with no body — the browser never reads it", () => {
    const { res: r, spy } = res();
    handler(req(), r);

    expect(spy.status).toHaveBeenCalledWith(204);
    expect(spy.end).toHaveBeenCalled();
  });
});

describe("CORS", () => {
  it("echoes an allowed origin", () => {
    const { res: r, headers } = res();
    handler(
      req({
        headers: {
          origin: "https://erick-market-2025.vercel.app",
          "x-forwarded-for": "203.0.113.1",
        },
      }),
      r,
    );

    expect(headers["Access-Control-Allow-Origin"]).toBe(
      "https://erick-market-2025.vercel.app",
    );
  });

  it("sends no allow-origin for a foreign site", () => {
    const { res: r, headers } = res();
    handler(
      req({
        headers: {
          origin: "https://evil.example",
          "x-forwarded-for": "203.0.113.2",
        },
      }),
      r,
    );

    expect(headers["Access-Control-Allow-Origin"]).toBeUndefined();
  });
});

describe("validation", () => {
  it("rejects a body with no events", () => {
    const { res: r, spy } = res();
    handler(req({ body: {} }), r);

    expect(spy.status).toHaveBeenCalledWith(400);
  });

  it("rejects an event with no kind or name", () => {
    const { res: r, spy } = res();
    handler(req({ body: { events: [{ message: "orphan" }] } }), r);

    expect(spy.status).toHaveBeenCalledWith(400);
  });

  it("accepts a bare array as well as an events object", () => {
    const { res: r, spy } = res();
    handler(req({ body: [{ kind: "vital", name: "LCP", value: 1200 }] }), r);

    expect(spy.status).toHaveBeenCalledWith(204);
  });

  it("parses a JSON string body, which is what sendBeacon sends", () => {
    const log = vi.spyOn(console, "error");
    const { res: r, spy } = res();
    handler(
      req({
        body: JSON.stringify({
          events: [{ kind: "error", name: "boundary:root", message: "boom" }],
        }),
      }),
      r,
    );

    expect(spy.status).toHaveBeenCalledWith(204);
    expect(logged(log)[0]).toMatchObject({ name: "boundary:root" });
  });

  it("rejects a body that is not JSON", () => {
    const { res: r, spy } = res();
    handler(req({ body: "{ not json" }), r);

    expect(spy.status).toHaveBeenCalledWith(400);
  });

  it("drops the malformed entries rather than the whole batch", () => {
    const log = vi.spyOn(console, "error");
    const { res: r, spy } = res();
    handler(
      req({
        body: {
          events: [
            { kind: "error", name: "good", message: "kept" },
            { nonsense: true },
            null,
          ],
        },
      }),
      r,
    );

    expect(spy.status).toHaveBeenCalledWith(204);
    expect(logged(log)).toHaveLength(1);
  });

  it("caps how many events one request can carry", () => {
    const log = vi.spyOn(console, "error");
    const { res: r } = res();
    handler(
      req({
        body: {
          events: Array.from({ length: 100 }, (_, i) => ({
            kind: "error",
            name: `e${i}`,
          })),
        },
      }),
      r,
    );

    expect(logged(log).length).toBeLessThanOrEqual(20);
  });

  it("truncates an oversized stack instead of logging it whole", () => {
    const log = vi.spyOn(console, "error");
    const { res: r } = res();
    handler(
      req({
        body: {
          events: [{ kind: "error", name: "big", stack: "x".repeat(50_000) }],
        },
      }),
      r,
    );

    expect(logged(log)[0].stack.length).toBeLessThanOrEqual(4_000);
  });

  it("refuses an oversized raw body outright", () => {
    const { res: r, spy } = res();
    handler(req({ body: JSON.stringify({ x: "y".repeat(40_000) }) }), r);

    expect(spy.status).toHaveBeenCalledWith(400);
  });

  it("keeps only the ratings web-vitals actually emits", () => {
    const log = vi.spyOn(console, "log");
    const { res: r } = res();
    handler(
      req({
        body: {
          events: [
            { kind: "vital", name: "LCP", value: 1, rating: "good" },
            { kind: "vital", name: "CLS", value: 1, rating: "excellent" },
          ],
        },
      }),
      r,
    );

    const events = logged(log);
    expect(events[0].rating).toBe("good");
    expect(events[1].rating).toBeUndefined();
  });
});

describe("logging", () => {
  it("writes errors to stderr and vitals to stdout", () => {
    const log = vi.spyOn(console, "log");
    const error = vi.spyOn(console, "error");
    const { res: r } = res();

    handler(
      req({
        body: {
          events: [
            { kind: "error", name: "boundary:chart", message: "boom" },
            { kind: "vital", name: "LCP", value: 1200, rating: "good" },
          ],
        },
      }),
      r,
    );

    expect(logged(error)[0]).toMatchObject({ level: "error", kind: "error" });
    expect(logged(log)[0]).toMatchObject({ level: "info", kind: "vital" });
  });

  it("marks the events as coming from the browser", () => {
    const error = vi.spyOn(console, "error");
    const { res: r } = res();
    handler(req(), r);

    expect(logged(error)[0].source).toBe("client");
  });

  it("never logs a raw client IP", () => {
    const error = vi.spyOn(console, "error");
    const { res: r } = res();
    handler(
      req({ headers: { "x-forwarded-for": "203.0.113.5, 70.41.3.18" } }),
      r,
    );

    const entry = logged(error)[0];
    expect(JSON.stringify(entry)).not.toContain("203.0.113.5");
    expect(entry.client).toBeTruthy();
  });

  it("emits one parseable line per event", () => {
    const error = vi.spyOn(console, "error");
    const { res: r } = res();
    handler(
      req({
        body: {
          events: [
            { kind: "error", name: "a" },
            { kind: "error", name: "b" },
          ],
        },
      }),
      r,
    );

    expect(error).toHaveBeenCalledTimes(2);
  });

  it("carries the session id through, so events can be correlated", () => {
    const error = vi.spyOn(console, "error");
    const { res: r } = res();
    handler(
      req({
        body: {
          events: [{ kind: "error", name: "a", sessionId: "sess-123" }],
        },
      }),
      r,
    );

    expect(logged(error)[0].sessionId).toBe("sess-123");
  });
});

describe("rate limiting", () => {
  it("stops a client flooding the drain", () => {
    const ip = "198.51.100.77";
    for (let i = 0; i < 30; i++)
      handler(req({ headers: { "x-forwarded-for": ip } }), res().res);

    const { res: r, spy, headers } = res();
    handler(req({ headers: { "x-forwarded-for": ip } }), r);

    expect(spy.status).toHaveBeenCalledWith(429);
    expect(Number(headers["Retry-After"])).toBeGreaterThan(0);
  });

  it("is tighter than the read routes, since a page emits few beacons", () => {
    const { res: r, headers } = res();
    handler(req({ headers: { "x-forwarded-for": "198.51.100.9" } }), r);

    expect(headers["X-RateLimit-Limit"]).toBe("30");
  });
});
