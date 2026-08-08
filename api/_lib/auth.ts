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
    throw Object.assign(new Error("Authentication required"), {
      status: 401,
      code: "token_missing",
    });
  }
  const token = authorization.slice(7).trim();
  if (!token) {
    throw Object.assign(new Error("Authentication required"), {
      status: 401,
      code: "token_missing",
    });
  }

  const domain = process.env.AUTH0_DOMAIN;
  const audience = process.env.AUTH0_AUDIENCE;
  if (!domain || !audience) {
    throw Object.assign(new Error("Auth is not configured on the server"), {
      status: 503,
      code: "auth_not_configured",
    });
  }

  let payload: JWTPayload;
  try {
    ({ payload } = await jwtVerify(token, getJwks(domain), {
      issuer: `https://${domain}/`,
      audience,
    }));
  } catch (err) {
    // jose messages like '"exp" claim timestamp check failed' are library
    // internals: unhelpful to a user and needless detail for an attacker.
    // Collapse them to a stable code the client can act on.
    const code =
      (err as { code?: string })?.code === "ERR_JWT_EXPIRED"
        ? "token_expired"
        : "token_invalid";
    throw Object.assign(new Error("Authentication failed"), {
      status: 401,
      code,
    });
  }

  return claimsToUser(payload);
}

function claimsToUser(payload: JWTPayload): AuthUser {
  const sub = typeof payload.sub === "string" ? payload.sub : "";
  if (!sub) {
    throw Object.assign(new Error("Authentication failed"), {
      status: 401,
      code: "token_invalid",
    });
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
