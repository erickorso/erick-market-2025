/**
 * Post-deploy smoke check.
 *
 * A build passing CI says the code compiles; it says nothing about whether the
 * thing that is now live answers. These are the checks that were being run by
 * hand with curl after every deploy — same checks, but they fail loudly and
 * nobody has to remember them.
 *
 *   npm run smoke                          # against production
 *   SMOKE_BASE_URL=https://... npm run smoke
 *
 * The default path needs no secrets, so it can run anywhere. Set SMOKE_TOKEN to
 * also exercise the authenticated trade path.
 */

const BASE = (
  process.env.SMOKE_BASE_URL || "https://erick-market-2025.vercel.app"
).replace(/\/$/, "");
const TOKEN = process.env.SMOKE_TOKEN;

let failures = 0;

function report(ok, name, detail = "") {
  if (!ok) failures++;
  const mark = ok ? "ok  " : "FAIL";
  console.log(`${mark} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function check(name, path, expect) {
  try {
    const res = await fetch(`${BASE}${path}`);
    const body = await res.text();
    const parsed = safeJson(body);
    const problem = expect({ status: res.status, body: parsed, res });
    report(!problem, name, problem || `${res.status}`);
    return parsed;
  } catch (err) {
    report(false, name, err instanceof Error ? err.message : String(err));
    return null;
  }
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

console.log(`smoke: ${BASE}\n`);

await check("home responds", "/", ({ status }) =>
  status === 200 ? null : `expected 200, got ${status}`,
);

// Shape, not just status: a 200 carrying the wrong payload is the failure a
// status check misses.
await check("quotes returns a catalog page", "/api/quotes?limit=3", (r) => {
  if (r.status !== 200) return `expected 200, got ${r.status}`;
  if (!Array.isArray(r.body?.stocks)) return "no stocks array";
  if (typeof r.body?.source !== "string") return "no source";
  return null;
});

await check("hot gainers respond", "/api/hot", (r) =>
  r.status === 200 ? null : `expected 200, got ${r.status}`,
);

await check("league board is public", "/api/league", (r) => {
  if (r.status !== 200) return `expected 200, got ${r.status}`;
  if (!Array.isArray(r.body?.entries)) return "no entries array";
  return null;
});

// The one that matters most: the guard has to hold from outside.
for (const path of ["/api/me", "/api/portfolio", "/api/avatar"]) {
  await check(`${path} refuses an anonymous caller`, path, (r) =>
    r.status === 401 ? null : `expected 401, got ${r.status}`,
  );
}

await (async () => {
  const name = "trade refuses an anonymous caller";
  try {
    const res = await fetch(`${BASE}/api/trade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ side: "buy", symbol: "AAPL", qty: 1 }),
    });
    report(res.status === 401, name, `${res.status}`);
  } catch (err) {
    report(false, name, err instanceof Error ? err.message : String(err));
  }
})();

/**
 * Only with a token. Buys one share twice under the same key: the second call
 * must be a replay, not a purchase. That is the guarantee the whole
 * idempotency design exists for, and this is the only place it is checked
 * against a real deployment rather than a mock.
 */
if (TOKEN) {
  const key =
    process.env.SMOKE_IDEMPOTENCY_KEY || `smoke-${Date.now().toString(36)}`;
  const buy = () =>
    fetch(`${BASE}/api/trade`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`,
        "Idempotency-Key": key,
      },
      body: JSON.stringify({
        side: "buy",
        symbol: "AAPL",
        company: "Apple Inc.",
        qty: 1,
      }),
    });

  try {
    const first = await buy();
    const firstBody = await first.json();
    report(first.ok, "authenticated buy succeeds", `${first.status}`);

    const second = await buy();
    const secondBody = await second.json();
    report(
      second.status === 200 &&
        second.headers.get("idempotent-replay") === "true",
      "the same key replays instead of buying twice",
      `${second.status} replay=${second.headers.get("idempotent-replay")}`,
    );
    report(
      JSON.stringify(firstBody) === JSON.stringify(secondBody),
      "the replay returns the original response",
    );
  } catch (err) {
    report(false, "idempotent buy", err instanceof Error ? err.message : "");
  }
} else {
  console.log("skip  authenticated trade checks — set SMOKE_TOKEN to run them");
}

console.log(failures ? `\n${failures} failed` : "\nall good");
process.exit(failures ? 1 : 0);
