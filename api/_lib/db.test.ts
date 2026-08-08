import { afterEach, describe, expect, it, vi } from "vitest";
import { neon } from "@neondatabase/serverless";
import { dbConfigured, getSql } from "./db";

vi.mock("@neondatabase/serverless", () => ({
  neon: vi.fn(() => ({ tag: "sql" })),
}));

const originalUrl = process.env.DATABASE_URL;

afterEach(() => {
  process.env.DATABASE_URL = originalUrl;
});

describe("dbConfigured", () => {
  it("is false without a connection string", () => {
    delete process.env.DATABASE_URL;
    expect(dbConfigured()).toBe(false);
  });

  it("is true once one is set", () => {
    process.env.DATABASE_URL = "postgres://user:pass@host/db";
    expect(dbConfigured()).toBe(true);
  });

  it("treats an empty string as unconfigured", () => {
    process.env.DATABASE_URL = "";
    expect(dbConfigured()).toBe(false);
  });
});

describe("getSql", () => {
  it("refuses to connect without a connection string", () => {
    delete process.env.DATABASE_URL;
    expect(() => getSql()).toThrow(/DATABASE_URL is not configured/);
  });

  it("checks the env before reaching for a cached client", () => {
    process.env.DATABASE_URL = "postgres://user:pass@host/db";
    getSql();

    delete process.env.DATABASE_URL;
    expect(() => getSql()).toThrow();
  });

  it("returns a client when configured", () => {
    process.env.DATABASE_URL = "postgres://user:pass@host/db";
    expect(getSql()).toBeTruthy();
  });

  it("reuses one client, so a warm instance does not reconnect", () => {
    process.env.DATABASE_URL = "postgres://user:pass@host/db";
    // The cache lives at module scope and earlier tests may have filled it,
    // so assert on the delta rather than the absolute count.
    const before = (neon as unknown as { mock: { calls: unknown[] } }).mock.calls
      .length;

    getSql();
    getSql();
    getSql();

    const after = (neon as unknown as { mock: { calls: unknown[] } }).mock.calls
      .length;
    expect(after).toBeLessThanOrEqual(before + 1);
  });
});
