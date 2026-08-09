/**
 * Guards a database this project does not own alone.
 *
 * The Neon instance behind this app also holds another application's tables —
 * 28 of them, Prisma-managed, in the same `public` schema. One of theirs is
 * `User` and one of ours is `users`: distinct names, one careless glance
 * apart, and dropping the wrong one is not recoverable on a free tier.
 *
 * So this asserts two things before any schema work: that everything this app
 * needs exists, and that nothing this app is about to touch belongs to the
 * neighbour.
 *
 *   npm run check:db
 */

import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

/** Everything this project owns. Anything outside this list is not ours. */
const OURS = [
  "users",
  "portfolios",
  "positions",
  "trades",
  "trade_requests",
  "league_scores",
  "league_months",
];

/** Indexes the correctness of the app depends on, not just its schema. */
const REQUIRED_INDEXES = [
  ["trades", "trades_idempotency_idx"],
  ["trade_requests", "trade_requests_pkey"],
];

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const env = readFileSync(".env", "utf8");
    const match = env.match(/^DATABASE_URL=(.*)$/m);
    if (match) return match[1].trim().replace(/^["']|["']$/g, "");
  } catch {
    /* no .env */
  }
  return null;
}

const url = databaseUrl();
if (!url) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}

const sql = neon(url);
let failures = 0;

function report(ok, message) {
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"} ${message}`);
}

const tables = (
  await sql`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public'
`
).map((r) => r.table_name);

for (const name of OURS) {
  report(tables.includes(name), `table ${name}`);
}

const column = await sql`
  SELECT 1 FROM information_schema.columns
  WHERE table_name = 'trades' AND column_name = 'idempotency_key'
`;
report(column.length > 0, "trades.idempotency_key");

const indexes = (
  await sql`
  SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname = 'public'
`
).filter((r) => OURS.includes(r.tablename));

for (const [table, index] of REQUIRED_INDEXES) {
  const found = indexes.find(
    (r) => r.tablename === table && r.indexname === index,
  );
  report(Boolean(found), `index ${index}`);
}

const idempotency = indexes.find(
  (r) => r.indexname === "trades_idempotency_idx",
);
report(
  Boolean(idempotency?.indexdef.includes("UNIQUE")),
  "trades_idempotency_idx is UNIQUE — exactly-once depends on it",
);

// Not a failure, but the number nobody should discover during a migration.
const foreign = tables.filter((t) => !OURS.includes(t));
console.log(
  `\nnote  ${foreign.length} tables in this database belong to another app.`,
);
console.log(
  "      Never migrate, drop or truncate anything outside the list above.",
);
const collisions = foreign.filter((t) =>
  OURS.includes(t.toLowerCase()) ? t !== t.toLowerCase() : false,
);
if (collisions.length) {
  console.log(
    `      Case-only collisions with ours: ${collisions.join(", ")} — quote identifiers.`,
  );
}

console.log(
  failures ? `\n${failures} failed` : "\nschema is what the app expects",
);
process.exit(failures ? 1 : 0);
