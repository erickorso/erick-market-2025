import { afterEach, describe, expect, it, vi } from "vitest";
import type { VercelRequest } from "@vercel/node";
import { buildLog, logRequest, requestId } from "./logger";

function req(over: Partial<VercelRequest> = {}): VercelRequest {
  return {
    url: "/api/quotes?limit=10",
    method: "GET",
    headers: {},
    ...over,
  } as unknown as VercelRequest;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("requestId", () => {
  it("prefers Vercel's own trace id", () => {
    expect(requestId(req({ headers: { "x-vercel-id": "iad1::abc" } }))).toBe(
      "iad1::abc",
    );
  });

  it("falls back to a generic request id header", () => {
    expect(requestId(req({ headers: { "x-request-id": "r-1" } }))).toBe("r-1");
  });

  it("uses a placeholder when neither is present", () => {
    expect(requestId(req())).toBe("-");
  });
});

describe("buildLog", () => {
  it("strips the query string, so paths group cleanly", () => {
    expect(buildLog(req(), 200, Date.now()).route).toBe("/api/quotes");
  });

  it("records the method and status", () => {
    const entry = buildLog(req({ method: "POST" }), 201, Date.now());

    expect(entry.method).toBe("POST");
    expect(entry.status).toBe(201);
  });

  it("measures how long the request took", () => {
    const entry = buildLog(req(), 200, Date.now() - 50);
    expect(entry.ms).toBeGreaterThanOrEqual(50);
  });

  it("grades the level by status", () => {
    expect(buildLog(req(), 200, Date.now()).level).toBe("info");
    expect(buildLog(req(), 404, Date.now()).level).toBe("warn");
    expect(buildLog(req(), 429, Date.now()).level).toBe("warn");
    expect(buildLog(req(), 500, Date.now()).level).toBe("error");
  });

  it("never logs a raw client IP", () => {
    const entry = buildLog(
      req({ headers: { "x-forwarded-for": "203.0.113.5, 70.41.3.18" } }),
      200,
      Date.now(),
    );

    expect(entry.client).not.toContain("203.0.113.5");
    expect(entry.client).toBeTruthy();
  });

  it("hashes the same client to the same value", () => {
    const headers = { "x-forwarded-for": "203.0.113.5" };
    const a = buildLog(req({ headers }), 200, Date.now());
    const b = buildLog(req({ headers }), 200, Date.now());

    expect(a.client).toBe(b.client);
  });

  it("hashes different clients differently", () => {
    const a = buildLog(
      req({ headers: { "x-forwarded-for": "203.0.113.5" } }),
      200,
      Date.now(),
    );
    const b = buildLog(
      req({ headers: { "x-forwarded-for": "198.51.100.9" } }),
      200,
      Date.now(),
    );

    expect(a.client).not.toBe(b.client);
  });

  it("attaches the error message on a failure", () => {
    const entry = buildLog(req(), 500, Date.now(), new Error("db down"));
    expect(entry.error).toBe("db down");
  });

  it("omits the error field on success", () => {
    expect(buildLog(req(), 200, Date.now())).not.toHaveProperty("error");
  });

  it("falls back gracefully on a request with no url", () => {
    expect(buildLog(req({ url: undefined }), 200, Date.now()).route).toBe(
      "unknown",
    );
  });
});

describe("logRequest", () => {
  it("writes one JSON line so drains can parse it", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    logRequest(buildLog(req(), 200, Date.now()));

    expect(log).toHaveBeenCalledTimes(1);
    expect(() => JSON.parse(log.mock.calls[0][0])).not.toThrow();
  });

  it("routes a server failure to stderr", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    logRequest(buildLog(req(), 500, Date.now()));

    expect(error).toHaveBeenCalledTimes(1);
  });

  it("routes a client failure to warn", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    logRequest(buildLog(req(), 404, Date.now()));

    expect(warn).toHaveBeenCalledTimes(1);
  });
});
