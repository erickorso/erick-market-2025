import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

export type AuthUser = {
  sub: string;
  email?: string;
  name?: string;
  nickname?: string;
};

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJwks(domain: string) {
  let jwks = jwksCache.get(domain);
  if (!jwks) {
    jwks = createRemoteJWKSet(
      new URL(`https://${domain}/.well-known/jwks.json`),
    );
    jwksCache.set(domain, jwks);
  }
  return jwks;
}

export async function verifyBearer(
  authorization: string | undefined,
): Promise<AuthUser> {
  if (!authorization?.startsWith("Bearer ")) {
    throw Object.assign(new Error("Missing Bearer token"), { status: 401 });
  }
  const token = authorization.slice(7).trim();
  if (!token) {
    throw Object.assign(new Error("Missing Bearer token"), { status: 401 });
  }

  const domain = process.env.AUTH0_DOMAIN;
  const audience = process.env.AUTH0_AUDIENCE;
  if (!domain || !audience) {
    throw Object.assign(new Error("Auth0 server env not configured"), {
      status: 503,
    });
  }

  const { payload } = await jwtVerify(token, getJwks(domain), {
    issuer: `https://${domain}/`,
    audience,
  });

  return claimsToUser(payload);
}

function claimsToUser(payload: JWTPayload): AuthUser {
  const sub = typeof payload.sub === "string" ? payload.sub : "";
  if (!sub) {
    throw Object.assign(new Error("Invalid token subject"), { status: 401 });
  }
  return {
    sub,
    email: typeof payload.email === "string" ? payload.email : undefined,
    name: typeof payload.name === "string" ? payload.name : undefined,
    nickname:
      typeof payload.nickname === "string" ? payload.nickname : undefined,
  };
}

export function getBearer(req: { headers?: Record<string, unknown> }) {
  const h = req.headers?.authorization ?? req.headers?.Authorization;
  return typeof h === "string" ? h : undefined;
}
