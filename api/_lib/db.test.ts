import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@neondatabase/serverless", () => ({
  neon: vi.fn(() => ({ tag: "sql" })),
}));

const originalUrl = process.env.DATABASE_URL;

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  process.env.DATABASE_URL = originalUrl;
});

describe("dbConfigured", () => {
  it("is false without a connection string", async () => {
    delete process.env.DATABASE_URL;
    const { dbConfigured } = await import("./db");

    expect(dbConfigured()).toBe(false);
  });

  it("is true once one is set", async () => {
    process.env.DATABASE_URL = "postgres://user:pass@host/db";
    const { dbConfigured } = await import("./db");

    expect(dbConfigured()).toBe(true);
  });
});

describe("getSql", () => {
  it("refuses to connect without a connection string", async () => {
    delete process.env.DATABASE_URL;
    const { getSql } = await import("./db");

    expect(() => getSql()).toThrow(/DATABASE_URL is not configured/);
  });

  it("returns a client when configured", async () => {
    process.env.DATABASE_URL = "postgres://user:pass@host/db";
    const { getSql } = await import("./db");

    expect(getSql()).toBeTruthy();
  });

  it("reuses one client across calls, so a warm instance does not reconnect", async () => {
    process.env.DATABASE_URL = "postgres://user:pass@host/db";
    const { neon } = await import("@neondatabase/serverless");
    const { getSql } = await import("./db");

    getSql();
    getSql();
    getSql();

    expect(neon).toHaveBeenCalledTimes(1);
  });
});
