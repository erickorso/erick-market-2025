import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getBearer, verifyBearer } from "./auth";

const jwtVerify = vi.hoisted(() => vi.fn());

vi.mock("jose", () => ({
  jwtVerify,
  createRemoteJWKSet: vi.fn(() => "jwks"),
}));

const originalDomain = process.env.AUTH0_DOMAIN;
const originalAudience = process.env.AUTH0_AUDIENCE;

beforeEach(() => {
  process.env.AUTH0_DOMAIN = "tenant.eu.auth0.com";
  process.env.AUTH0_AUDIENCE = "https://erick-market-api";
  jwtVerify.mockReset().mockResolvedValue({ payload: { sub: "auth0|1" } });
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

  it("verifies against the tenant's JWKS, issuer and audience", async () => {
    await verifyBearer("Bearer tok");

    expect(jwtVerify).toHaveBeenCalledWith("tok", "jwks", {
      issuer: "https://tenant.eu.auth0.com/",
      audience: "https://erick-market-api",
    });
  });

  it("strips the scheme before verifying", async () => {
    await verifyBearer("Bearer   tok   ");
    expect(jwtVerify.mock.calls[0][0]).toBe("tok");
  });

  it("returns the claims it recognises", async () => {
    jwtVerify.mockResolvedValue({
      payload: {
        sub: "auth0|1",
        email: "trader@example.com",
        name: "Erick Vargas",
        nickname: "erickorso",
      },
    });

    expect(await verifyBearer("Bearer tok")).toEqual({
      sub: "auth0|1",
      email: "trader@example.com",
      name: "Erick Vargas",
      nickname: "erickorso",
    });
  });

  it("drops claims that are not strings", async () => {
    jwtVerify.mockResolvedValue({
      payload: { sub: "auth0|1", email: 42, name: null },
    });

    const user = await verifyBearer("Bearer tok");

    expect(user.email).toBeUndefined();
    expect(user.name).toBeUndefined();
  });

  it("rejects a token with no subject", async () => {
    jwtVerify.mockResolvedValue({ payload: { email: "a@b.c" } });
    const err = await status(verifyBearer("Bearer tok"));

    expect(err?.status).toBe(401);
    expect(err?.message).toMatch(/subject/i);
  });

  it("rejects a token whose subject is not a string", async () => {
    jwtVerify.mockResolvedValue({ payload: { sub: 123 } });
    expect((await status(verifyBearer("Bearer tok")))?.status).toBe(401);
  });

  it("lets a signature failure surface", async () => {
    jwtVerify.mockRejectedValue(new Error("signature verification failed"));
    await expect(verifyBearer("Bearer tok")).rejects.toThrow(/signature/);
  });

  it("caches the JWKS per tenant, so a warm instance does not refetch", async () => {
    const { createRemoteJWKSet } = await import("jose");
    const calls = (createRemoteJWKSet as unknown as { mock: { calls: unknown[] } })
      .mock.calls;

    // The cache lives at module scope, so it may already be warm. Either way,
    // three verifications against one tenant must not build it three times.
    const before = calls.length;
    await verifyBearer("Bearer tok");
    await verifyBearer("Bearer tok");
    await verifyBearer("Bearer tok");

    expect(calls.length).toBeLessThanOrEqual(before + 1);
  });
});
