import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}

const sql = neon(url);
const schema = readFileSync("db/schema.sql", "utf8");

// Strip comments and split on semicolons; run statements one by one
const statements = schema
  .split(";")
  .map((s) =>
    s
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n")
      .trim(),
  )
  .filter(Boolean);

for (const statement of statements) {
  await sql.query(statement);
  console.log("ok:", statement.slice(0, 60).replace(/\s+/g, " "), "…");
}

console.log("schema applied:", statements.length, "statements");
