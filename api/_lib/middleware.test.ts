import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withAuth, withPublic } from "./middleware";
import { resetRateLimits } from "./rateLimit";

const verifyBearer = vi.hoisted(() => vi.fn());
const upsertUser = vi.hoisted(() => vi.fn());
const dbConfigured = vi.hoisted(() => vi.fn());

vi.mock("./auth.js", () => ({
  verifyBearer,
  getBearer: (req: { headers?: Record<string, unknown> }) =>
    req.headers?.authorization as string | undefined,
}));

vi.mock("./db.js", () => ({ dbConfigured }));
vi.mock("./store.js", () => ({ upsertUser }));

function mockReq(over: Partial<VercelRequest> = {}): VercelRequest {
  return {
    url: "/api/me",
    method: "GET",
    headers: { authorization: "Bearer tok", "x-forwarded-for": "203.0.113.5" },
    socket: {},
    ...over,
  } as unknown as VercelRequest;
}

function mockRes() {
  const headers: Record<string, string> = {};
  const res = {
    statusCode: 200,
    setHeader: (k: string, v: string) => {
      headers[k] = v;
    },
    status: vi.fn(function (this: unknown, code: number) {
      (res as { statusCode: number }).statusCode = code;
      return res;
    }),
    json: vi.fn(() => res),
    end: vi.fn(() => res),
  };
  return { res: res as unknown as VercelResponse, headers, spy: res };
}

beforeEach(() => {
  resetRateLimits();
  verifyBearer.mockReset().mockResolvedValue({ sub: "auth0|1" });
  upsertUser.mockReset().mockResolvedValue({ id: "u1" });
  dbConfigured.mockReset().mockReturnValue(true);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("withAuth", () => {
  it("passes the verified user to the handler", async () => {
    const handler = vi.fn();
    const { res } = mockRes();

    await withAuth(handler)(mockReq(), res);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][2]).toEqual({
      auth: { sub: "auth0|1" },
      user: { id: "u1" },
    });
  });

  it("answers a preflight without running the handler", async () => {
    const handler = vi.fn();
    const { res, spy } = mockRes();

    await withAuth(handler)(mockReq({ method: "OPTIONS" }), res);

    expect(handler).not.toHaveBeenCalled();
    expect(spy.status).toHaveBeenCalledWith(204);
  });

  it("sets CORS headers on every response", async () => {
    const { res, headers } = mockRes();

    await withAuth(vi.fn())(
      mockReq({
        headers: {
          authorization: "Bearer tok",
          origin: "https://erick-market-2025.vercel.app",
        },
      }),
      res,
    );

    expect(headers["Access-Control-Allow-Origin"]).toBe(
      "https://erick-market-2025.vercel.app",
    );
    expect(headers["Vary"]).toBe("Origin");
  });

  it("rejects once the rate limit is spent", async () => {
    const handler = vi.fn();
    const wrapped = withAuth(handler);

    for (let i = 0; i < 60; i++) await wrapped(mockReq(), mockRes().res);
    handler.mockClear();

    const { res, spy } = mockRes();
    await wrapped(mockReq(), res);

    expect(spy.status).toHaveBeenCalledWith(429);
    expect(handler).not.toHaveBeenCalled();
  });

  it("refuses to run without a database", async () => {
    dbConfigured.mockReturnValue(false);
    const handler = vi.fn();
    const { res, spy } = mockRes();

    await withAuth(handler)(mockReq(), res);

    expect(spy.status).toHaveBeenCalledWith(503);
    expect(handler).not.toHaveBeenCalled();
  });

  it("turns a rejected token into its own status", async () => {
    verifyBearer.mockRejectedValue(
      Object.assign(new Error("Missing Bearer token"), { status: 401 }),
    );
    const handler = vi.fn();
    const { res, spy } = mockRes();

    await withAuth(handler)(mockReq(), res);

    expect(spy.status).toHaveBeenCalledWith(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("turns an unexpected handler failure into a 500", async () => {
    const { res, spy } = mockRes();

    await withAuth(() => {
      throw new Error("boom");
    })(mockReq(), res);

    expect(spy.status).toHaveBeenCalledWith(500);
  });

  it("logs one line per request", async () => {
    const { res } = mockRes();
    await withAuth(vi.fn())(mockReq(), res);

    expect(console.log).toHaveBeenCalledTimes(1);
    expect(() =>
      JSON.parse((console.log as unknown as { mock: { calls: string[][] } }).mock.calls[0][0]),
    ).not.toThrow();
  });

  it("logs a failure at error level", async () => {
    const { res } = mockRes();
    await withAuth(() => {
      throw new Error("boom");
    })(mockReq(), res);

    expect(console.error).toHaveBeenCalled();
  });
});

describe("withPublic", () => {
  it("runs the handler without requiring a token", async () => {
    const handler = vi.fn();
    const { res } = mockRes();

    await withPublic(handler)(mockReq({ headers: {} }), res);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(verifyBearer).not.toHaveBeenCalled();
  });

  it("allows a looser budget than the authed routes", async () => {
    const handler = vi.fn();
    const wrapped = withPublic(handler);

    for (let i = 0; i < 100; i++) await wrapped(mockReq(), mockRes().res);

    // 100 is past the authed limit of 60 but inside the public 120.
    expect(handler).toHaveBeenCalledTimes(100);
  });

  it("still answers preflight", async () => {
    const handler = vi.fn();
    const { res, spy } = mockRes();

    await withPublic(handler)(mockReq({ method: "OPTIONS" }), res);

    expect(spy.status).toHaveBeenCalledWith(204);
    expect(handler).not.toHaveBeenCalled();
  });

  it("reports an unexpected failure", async () => {
    const { res, spy } = mockRes();

    await withPublic(() => {
      throw new Error("boom");
    })(mockReq(), res);

    expect(spy.status).toHaveBeenCalledWith(500);
  });
});
