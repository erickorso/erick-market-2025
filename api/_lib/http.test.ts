import { afterEach, describe, expect, it } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { originOf, setCdnCache, setCors, statusOf } from "./http";

function mockRes() {
  const headers: Record<string, string> = {};
  return {
    res: {
      setHeader: (k: string, v: string) => {
        headers[k] = v;
      },
    } as unknown as VercelResponse,
    headers,
  };
}

afterEach(() => {
  delete process.env.ALLOWED_ORIGINS;
});

describe("setCors", () => {
  it("echoes the production origin", () => {
    const { res, headers } = mockRes();
    setCors(res, "https://erick-market-2025.vercel.app");

    expect(headers["Access-Control-Allow-Origin"]).toBe(
      "https://erick-market-2025.vercel.app",
    );
  });

  it("echoes the local dev origin", () => {
    const { res, headers } = mockRes();
    setCors(res, "http://localhost:5173");
    expect(headers["Access-Control-Allow-Origin"]).toBe("http://localhost:5173");
  });

  it("echoes Vercel preview deployments of this project", () => {
    const { res, headers } = mockRes();
    setCors(res, "https://erick-market-2025-abc123-erickorsos-projects.vercel.app");

    expect(headers["Access-Control-Allow-Origin"]).toBe(
      "https://erick-market-2025-abc123-erickorsos-projects.vercel.app",
    );
  });

  it("sends no allow-origin for a foreign site", () => {
    const { res, headers } = mockRes();
    setCors(res, "https://evil.example");

    expect(headers["Access-Control-Allow-Origin"]).toBeUndefined();
  });

  it("does not match a lookalike host", () => {
    const { res, headers } = mockRes();
    setCors(res, "https://erick-market-2025.vercel.app.evil.example");

    expect(headers["Access-Control-Allow-Origin"]).toBeUndefined();
  });

  it("honours extra origins from the environment", () => {
    process.env.ALLOWED_ORIGINS = "https://staging.example, https://demo.example";
    const { res, headers } = mockRes();
    setCors(res, "https://demo.example");

    expect(headers["Access-Control-Allow-Origin"]).toBe("https://demo.example");
  });

  it("always varies on origin so caches stay correct", () => {
    const { res, headers } = mockRes();
    setCors(res, "https://evil.example");

    expect(headers["Vary"]).toBe("Origin");
  });

  it("tolerates a request with no origin", () => {
    const { res, headers } = mockRes();
    setCors(res, undefined);

    expect(headers["Access-Control-Allow-Origin"]).toBeUndefined();
    expect(headers["Access-Control-Allow-Methods"]).toContain("GET");
  });
});

describe("originOf", () => {
  it("reads a plain header", () => {
    const req = {
      headers: { origin: "https://a.example" },
    } as unknown as VercelRequest;
    expect(originOf(req)).toBe("https://a.example");
  });

  it("reads a repeated header", () => {
    const req = {
      headers: { origin: ["https://a.example"] },
    } as unknown as VercelRequest;
    expect(originOf(req)).toBe("https://a.example");
  });
});

describe("setCdnCache", () => {
  it("keeps the browser honest while letting the edge serve", () => {
    const { res, headers } = mockRes();
    setCdnCache(res, { sMaxAge: 20, staleWhileRevalidate: 60 });

    expect(headers["Cache-Control"]).toBe(
      "public, max-age=0, s-maxage=20, stale-while-revalidate=60",
    );
  });
});

describe("statusOf", () => {
  it("uses the status carried on the error", () => {
    expect(statusOf(Object.assign(new Error("nope"), { status: 401 }))).toBe(401);
  });

  it("defaults to 500", () => {
    expect(statusOf(new Error("boom"))).toBe(500);
    expect(statusOf("boom")).toBe(500);
  });
});
