import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { Pool } from "pg";
import * as schema from "./schema";

export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local or run `npm run db:setup`.",
    );
  }
  return url;
}

// Neon's HTTP driver is the right fit for Vercel's serverless runtime; it is
// also the only one that works on the edge. Anything else (local Postgres,
// docker, CI) goes through the plain TCP pg driver.
function isNeon(url: string): boolean {
  if (process.env.DATABASE_DRIVER === "neon") return true;
  if (process.env.DATABASE_DRIVER === "pg") return false;
  try {
    return new URL(url).hostname.endsWith(".neon.tech");
  } catch {
    return false;
  }
}

function createDb(): Database {
  const url = connectionString();
  if (isNeon(url)) {
    return drizzleNeon(neon(url), { schema });
  }
  const pool = new Pool({ connectionString: url });
  return drizzlePg(pool, { schema });
}

// Cache across hot reloads in dev so we do not leak pools.
const globalForDb = globalThis as unknown as { __db?: Database };

export const db: Database = globalForDb.__db ?? createDb();
if (process.env.NODE_ENV !== "production") globalForDb.__db = db;

export { schema };
