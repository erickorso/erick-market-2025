import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getBearer, verifyBearer } from "./auth";

const originalDomain = process.env.AUTH0_DOMAIN;
const originalAudience = process.env.AUTH0_AUDIENCE;

beforeEach(() => {
  process.env.AUTH0_DOMAIN = "tenant.eu.auth0.com";
  process.env.AUTH0_AUDIENCE = "https://erick-market-api";
});

afterEach(() => {
  process.env.AUTH0_DOMAIN = originalDomain;
  process.env.AUTH0_AUDIENCE = originalAudience;
  vi.restoreAllMocks();
});

describe("getBearer", () => {
  it("reads the standard header", () => {
    expect(getBearer({ headers: { authorization: "Bearer abc" } })).toBe(
      "Bearer abc",
    );
  });

  it("tolerates the capitalised variant", () => {
    expect(getBearer({ headers: { Authorization: "Bearer abc" } })).toBe(
      "Bearer abc",
    );
  });

  it("returns nothing when the header is absent", () => {
    expect(getBearer({ headers: {} })).toBeUndefined();
    expect(getBearer({})).toBeUndefined();
  });

  it("ignores a non-string header", () => {
    expect(
      getBearer({ headers: { authorization: ["Bearer a", "Bearer b"] } }),
    ).toBeUndefined();
  });
});

describe("verifyBearer", () => {
  async function status(promise: Promise<unknown>) {
    return promise.then(
      () => null,
      (err: { status?: number; message: string }) => err,
    );
  }

  it("rejects a missing header as unauthorised", async () => {
    const err = await status(verifyBearer(undefined));
    expect(err?.status).toBe(401);
  });

  it("rejects a header that is not a Bearer token", async () => {
    const err = await status(verifyBearer("Basic abc"));
    expect(err?.status).toBe(401);
  });

  it("rejects an empty Bearer token", async () => {
    const err = await status(verifyBearer("Bearer    "));
    expect(err?.status).toBe(401);
  });

  it("reports a server misconfiguration as 503, not as the caller's fault", async () => {
    delete process.env.AUTH0_DOMAIN;
    const err = await status(verifyBearer("Bearer abc"));

    expect(err?.status).toBe(503);
    expect(err?.message).toMatch(/not configured/i);
  });

  it("also requires the audience to be configured", async () => {
    delete process.env.AUTH0_AUDIENCE;
    const err = await status(verifyBearer("Bearer abc"));
    expect(err?.status).toBe(503);
  });

  it("rejects a token that is not a real JWT", async () => {
    // Reaches jose, which fails to parse before any network call is made.
    await expect(verifyBearer("Bearer not-a-jwt")).rejects.toThrow();
  });
});
