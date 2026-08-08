import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let sql: NeonQueryFunction<false, false> | null = null;

export function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not configured");
  }
  if (!sql) sql = neon(url);
  return sql;
}

export function dbConfigured() {
  return Boolean(process.env.DATABASE_URL);
}
