#!/usr/bin/env node
// Makes sure the local Postgres database behind DATABASE_URL exists and is
// migrated. Runs before `npm run dev` (predev) and via `npm run db:setup`.
//
// - Creates .env.local from .env.example if there is no env file yet.
// - Skips itself when DATABASE_URL points at a non-local host (e.g. Neon).
// - Talks to the server with the `pg` driver this project already depends on,
//   so it needs no psql/createdb on PATH and works the same on every OS.
// - Starts Homebrew Postgres if it is installed but not running (macOS).
// - Creates the database if it is missing, then applies drizzle migrations.
//
// Set SKIP_DB_ENSURE=1 to bypass entirely.

import { spawnSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { existsSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import pg from "pg";

const root = resolve(import.meta.dirname, "..", "..");
const log = (msg) => console.log(`[db] ${msg}`);
const fail = (msg) => {
  console.error(`[db] ${msg}`);
  process.exit(1);
};

if (process.env.SKIP_DB_ENSURE) {
  log("SKIP_DB_ENSURE set, skipping local database check.");
  process.exit(0);
}

// 1. Env file. Next.js reads .env.local itself; we only need it here so the
//    DATABASE_URL is the same one the app will use.
const envLocal = resolve(root, ".env.local");
const envPlain = resolve(root, ".env");
if (!process.env.DATABASE_URL && !existsSync(envLocal) && !existsSync(envPlain)) {
  copyFileSync(resolve(root, ".env.example"), envLocal);
  log("created .env.local from .env.example");
}
loadEnv({ path: [envLocal, envPlain], override: false, quiet: true });

const rawUrl = process.env.DATABASE_URL;
if (!rawUrl) fail("DATABASE_URL is not set. See .env.example.");

let url;
try {
  url = new URL(rawUrl);
} catch {
  fail(`DATABASE_URL is not a valid URL: ${rawUrl}`);
}

const host = url.hostname || "localhost";
const port = url.port || "5432";
const dbName = decodeURIComponent(url.pathname.replace(/^\//, ""));

const localHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
if (!localHosts.has(host)) {
  log(`DATABASE_URL points at ${host}, not a local server. Nothing to do.`);
  process.exit(0);
}
if (!dbName) fail("DATABASE_URL has no database name in its path.");

/** The same connection string, pointed at an admin database instead. */
function adminUrl(database) {
  const copy = new URL(rawUrl);
  copy.pathname = `/${database}`;
  return copy.toString();
}

/**
 * Opens a short-lived connection. Returns the client, or null when the server
 * will not talk to us for this database.
 */
async function connect(connectionString) {
  const client = new pg.Client({
    connectionString,
    connectionTimeoutMillis: 4000,
  });
  try {
    await client.connect();
    return client;
  } catch (error) {
    await client.end().catch(() => {});
    return { error };
  }
}

function have(cmd) {
  const which = process.platform === "win32" ? "where" : "which";
  return spawnSync(which, [cmd], { stdio: "ignore" }).status === 0;
}

/** Any successful connection means the server is up, even if our database is not there yet. */
async function serverReady() {
  for (const database of ["postgres", "template1", dbName]) {
    const result = await connect(adminUrl(database));
    if (!result.error) {
      await result.end().catch(() => {});
      return true;
    }
    // "database does not exist" still proves the server answered.
    if (result.error?.code === "3D000") return true;
  }
  return false;
}

// 2. Is the server up? If not, try Homebrew before giving up.
if (!(await serverReady())) {
  log(`no Postgres server answering on ${host}:${port}`);
  let started = false;

  if (have("brew")) {
    const list = spawnSync("brew", ["list", "--formula"], { encoding: "utf8" });
    const formula = (list.stdout || "")
      .split(/\s+/)
      .filter((f) => /^postgresql(@\d+)?$/.test(f))
      .sort()
      .at(-1);

    if (formula) {
      log(`starting ${formula} via brew services`);
      const res = spawnSync("brew", ["services", "start", formula], {
        stdio: "inherit",
      });
      if (res.status === 0) {
        const deadline = Date.now() + 20_000;
        while (Date.now() < deadline && !started) {
          await sleep(500);
          started = await serverReady();
        }
      }
    }
  }

  if (!started) {
    fail(
      `could not reach Postgres at ${host}:${port}. Start your server and ` +
        `rerun. On macOS with Homebrew: brew services start postgresql@18. ` +
        `On Windows, start the "postgresql" service. If it is running but ` +
        `refusing the login, put the right user and password into ` +
        `DATABASE_URL in .env.local.`,
    );
  }
}

// 3. Create the database if it does not exist.
let admin = await connect(adminUrl("postgres"));
if (admin.error) admin = await connect(adminUrl("template1"));

if (admin.error) {
  // No admin database we can reach. If the target already exists, that is fine.
  const direct = await connect(rawUrl);
  if (direct.error) {
    fail(
      `connected to the server but could not open a database: ` +
        `${direct.error.message}`,
    );
  }
  await direct.end().catch(() => {});
  log(`database "${dbName}" exists`);
} else {
  const found = await admin.query(
    "select 1 from pg_database where datname = $1",
    [dbName],
  );
  if (found.rowCount > 0) {
    log(`database "${dbName}" exists`);
  } else {
    log(`creating database "${dbName}"`);
    // Identifiers cannot be parameterised, so quote it properly instead.
    await admin
      .query(`create database "${dbName.replace(/"/g, '""')}"`)
      .catch((error) => {
        fail(`could not create "${dbName}": ${error.message}`);
      });
  }
  await admin.end().catch(() => {});
}

// 4. Apply migrations.
log("applying migrations");
// Run drizzle-kit's own entry point with this Node, rather than going through
// npx and a shell: no PATH lookup, no quoting, same behaviour on every OS.
const drizzleKit = resolve(root, "node_modules", "drizzle-kit", "bin.cjs");
if (!existsSync(drizzleKit)) {
  fail("drizzle-kit is not installed. Run `npm install` first.");
}

const migrate = spawnSync(process.execPath, [drizzleKit, "migrate"], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: rawUrl },
});
if (migrate.status !== 0) fail("drizzle-kit migrate failed");

console.log(); // drizzle-kit leaves its spinner line open
log(`ready: ${rawUrl.replace(/:[^:@/]*@/, ":***@")}`);
