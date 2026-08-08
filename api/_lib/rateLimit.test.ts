import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  clientKey,
  enforceRateLimit,
  rateLimit,
  resetRateLimits,
} from "./rateLimit";

beforeEach(() => {
  resetRateLimits();
});

describe("rateLimit", () => {
  it("allows requests up to the limit", () => {
    for (let i = 0; i < 3; i++) {
      expect(rateLimit("ip", 3, 1000, 1000).allowed).toBe(true);
    }
  });

  it("blocks the request past the limit", () => {
    for (let i = 0; i < 3; i++) rateLimit("ip", 3, 1000, 1000);
    expect(rateLimit("ip", 3, 1000, 1000).allowed).toBe(false);
  });

  it("counts down the remaining budget", () => {
    expect(rateLimit("ip", 3, 1000, 1000).remaining).toBe(2);
    expect(rateLimit("ip", 3, 1000, 1000).remaining).toBe(1);
    expect(rateLimit("ip", 3, 1000, 1000).remaining).toBe(0);
  });

  it("keeps separate budgets per key", () => {
    for (let i = 0; i < 3; i++) rateLimit("a", 3, 1000, 1000);

    expect(rateLimit("a", 3, 1000, 1000).allowed).toBe(false);
    expect(rateLimit("b", 3, 1000, 1000).allowed).toBe(true);
  });

  it("frees the budget as the window slides", () => {
    for (let i = 0; i < 3; i++) rateLimit("ip", 3, 1000, 1000);
    expect(rateLimit("ip", 3, 1000, 1500).allowed).toBe(false);

    // First hit has aged out of the window by now.
    expect(rateLimit("ip", 3, 1000, 2001).allowed).toBe(true);
  });

  it("reports when the caller may retry", () => {
    for (let i = 0; i < 2; i++) rateLimit("ip", 2, 60_000, 1000);
    const blocked = rateLimit("ip", 2, 60_000, 31_000);

    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBe(30);
  });

  it("does not consume budget on a rejected request", () => {
    rateLimit("ip", 1, 1000, 1000);
    rateLimit("ip", 1, 1000, 1100);
    rateLimit("ip", 1, 1000, 1200);

    // Only the first hit was recorded, so the window clears from that point.
    expect(rateLimit("ip", 1, 1000, 2001).allowed).toBe(true);
  });
});

describe("clientKey", () => {
  it("takes the leftmost forwarded address", () => {
    const req = {
      headers: { "x-forwarded-for": "203.0.113.5, 70.41.3.18" },
      socket: {},
    } as unknown as VercelRequest;

    expect(clientKey(req)).toBe("203.0.113.5");
  });

  it("handles a repeated header", () => {
    const req = {
      headers: { "x-forwarded-for": ["203.0.113.5"] },
      socket: {},
    } as unknown as VercelRequest;

    expect(clientKey(req)).toBe("203.0.113.5");
  });

  it("falls back to a shared bucket rather than opting out", () => {
    const req = { headers: {}, socket: {} } as unknown as VercelRequest;
    expect(clientKey(req)).toBe("unknown");
  });
});

describe("enforceRateLimit", () => {
  function mockRes() {
    const headers: Record<string, string> = {};
    const res = {
      setHeader: (k: string, v: string) => {
        headers[k] = v;
      },
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    return { res: res as unknown as VercelResponse, headers, spy: res };
  }

  const req = {
    headers: { "x-forwarded-for": "203.0.113.5" },
    socket: {},
  } as unknown as VercelRequest;

  it("lets a request through and advertises the budget", () => {
    const { res, headers } = mockRes();

    expect(enforceRateLimit(req, res, { limit: 2, windowMs: 60_000 })).toBe(
      false,
    );
    expect(headers["X-RateLimit-Limit"]).toBe("2");
    expect(headers["X-RateLimit-Remaining"]).toBe("1");
  });

  it("answers 429 with Retry-After once the budget is gone", () => {
    const opts = { limit: 1, windowMs: 60_000 };
    enforceRateLimit(req, mockRes().res, opts);

    const { res, headers, spy } = mockRes();
    expect(enforceRateLimit(req, res, opts)).toBe(true);
    expect(spy.status).toHaveBeenCalledWith(429);
    expect(spy.json).toHaveBeenCalledWith({ error: "rate limit exceeded" });
    expect(Number(headers["Retry-After"])).toBeGreaterThan(0);
  });
});
