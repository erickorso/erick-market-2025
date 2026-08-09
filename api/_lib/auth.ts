import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

export type AuthUser = {
  sub: string;
  email?: string;
  name?: string;
  nickname?: string;
};

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

type ProfileClaims = Pick<AuthUser, "email" | "name" | "nickname">;

/** Profiles keyed by `sub`, so /userinfo is hit once per user per instance. */
const profileCache = new Map<string, { value: ProfileClaims; until: number }>();
const PROFILE_TTL_MS = 10 * 60 * 1000;

const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);

/**
 * An access token issued for a custom API carries only `sub` — `email`, `name`
 * and `nickname` live on the ID token and on /userinfo. Reading them off the
 * access token yields nothing, which is how every display name degraded to the
 * "Trader" placeholder.
 *
 * Failing soft is deliberate: identity here only decorates a profile row, so a
 * userinfo outage must not turn into a 401 on a request whose JWT was valid.
 */
async function fetchProfile(
  domain: string,
  token: string,
  sub: string,
): Promise<ProfileClaims> {
  const hit = profileCache.get(sub);
  if (hit && hit.until > Date.now()) return hit.value;
  try {
    const res = await fetch(`https://${domain}/userinfo`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return {};
    const body = (await res.json()) as Record<string, unknown>;
    const value: ProfileClaims = {
      email: str(body.email),
      name: str(body.name),
      nickname: str(body.nickname),
    };
    // Only cache a useful answer, so a transient empty response does not stick
    // around for the whole TTL.
    if (value.email || value.name || value.nickname) {
      profileCache.set(sub, { value, until: Date.now() + PROFILE_TTL_MS });
    }
    return value;
  } catch {
    return {};
  }
}

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

  const user = claimsToUser(payload);
  if (user.email || user.name || user.nickname) return user;
  return { ...user, ...(await fetchProfile(domain, token, user.sub)) };
}

/** Test seam: instances are long-lived, so the cache outlives a single case. */
export function __clearProfileCache() {
  profileCache.clear();
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
