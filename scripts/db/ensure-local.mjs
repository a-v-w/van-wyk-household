#!/usr/bin/env node
// Makes sure the local Postgres database behind DATABASE_URL exists and is
// migrated. Runs before `npm run dev` (predev) and via `npm run db:setup`.
//
// - Creates .env.local from .env.example if there is no env file yet.
// - Skips itself when DATABASE_URL points at a non-local host (e.g. Neon).
// - Starts Homebrew Postgres if it is installed but not running.
// - Creates the database if it is missing, then applies drizzle migrations.
//
// Set SKIP_DB_ENSURE=1 to bypass entirely.

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";

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
const user = url.username ? decodeURIComponent(url.username) : undefined;
const password = url.password ? decodeURIComponent(url.password) : undefined;

const localHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
if (!localHosts.has(host)) {
  log(`DATABASE_URL points at ${host}, not a local server. Nothing to do.`);
  process.exit(0);
}
if (!dbName) fail("DATABASE_URL has no database name in its path.");

const pgEnv = {
  ...process.env,
  PGHOST: host,
  PGPORT: port,
  ...(user ? { PGUSER: user } : {}),
  ...(password ? { PGPASSWORD: password } : {}),
};

function have(cmd) {
  return spawnSync("which", [cmd], { stdio: "ignore" }).status === 0;
}
function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { env: pgEnv, encoding: "utf8", ...opts });
}

for (const tool of ["pg_isready", "psql", "createdb"]) {
  if (!have(tool)) {
    fail(
      `${tool} not found on PATH. Install Postgres (brew install postgresql@18) ` +
        `or make sure its bin directory is on your PATH.`,
    );
  }
}

// 2. Is the server up? If not, try Homebrew before giving up.
function serverReady() {
  return run("pg_isready", ["-q"]).status === 0;
}

if (!serverReady()) {
  log(`no Postgres server answering on ${host}:${port}`);
  let started = false;
  if (have("brew")) {
    const list = run("brew", ["list", "--formula"]);
    const formula = (list.stdout || "")
      .split(/\s+/)
      .filter((f) => /^postgresql(@\d+)?$/.test(f))
      .sort()
      .at(-1);
    if (formula) {
      log(`starting ${formula} via brew services`);
      const res = run("brew", ["services", "start", formula], { stdio: "inherit" });
      if (res.status === 0) {
        const deadline = Date.now() + 20_000;
        while (Date.now() < deadline && !serverReady()) {
          execFileSync("sleep", ["0.5"]);
        }
        started = serverReady();
      }
    }
  }
  if (!started) {
    fail(
      `could not reach Postgres at ${host}:${port}. Start it (for Homebrew: ` +
        `brew services start postgresql@18) and rerun.`,
    );
  }
}

// 3. Create the database if it does not exist.
const exists = run("psql", [
  "-d",
  "postgres",
  "-Atc",
  `select 1 from pg_database where datname = '${dbName.replace(/'/g, "''")}'`,
]);
if (exists.status !== 0) {
  fail(`could not query the server:\n${exists.stderr}`);
}
if (exists.stdout.trim() === "1") {
  log(`database "${dbName}" exists`);
} else {
  log(`creating database "${dbName}"`);
  const created = run("createdb", [dbName], { stdio: "inherit" });
  if (created.status !== 0) fail(`createdb failed for "${dbName}"`);
}

// 4. Apply migrations.
log("applying migrations");
const migrate = spawnSync("npx", ["drizzle-kit", "migrate"], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: rawUrl },
});
if (migrate.status !== 0) fail("drizzle-kit migrate failed");

console.log(); // drizzle-kit leaves its spinner line open
log(`ready: ${rawUrl}`);
