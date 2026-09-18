# van-wyk-household

Next.js 16 (App Router, TypeScript, Tailwind) with Postgres via [Drizzle ORM](https://orm.drizzle.team). Local development runs against your own Postgres; production runs against [Neon](https://neon.tech) on Vercel.

## Prerequisites

- Node 20.11 or newer (`.nvmrc` says 22; `nvm use` picks it up).
- A Postgres server on your machine plus the `psql`, `createdb` and `pg_isready` client tools on your PATH. Any of these works:
  - Homebrew: `brew install postgresql@18 && brew services start postgresql@18`. Connects as your macOS user with no password, which matches the default `DATABASE_URL`.
  - [Postgres.app](https://postgresapp.com): install, start a server, then add `/Applications/Postgres.app/Contents/Versions/latest/bin` to your PATH so the client tools are found.
  - Anything else (Docker, a system package): set `DATABASE_URL` in `.env.local` to match its host, port, user and password, e.g. `postgresql://postgres:postgres@localhost:5432/van_wyk_household`.

## First run after cloning

```bash
nvm use
npm install
npm run dev
```

Then open <http://localhost:3000>. The page reports whether the database is reachable, and <http://localhost:3000/api/health> returns JSON with the database time. If the first `npm run dev` fails, the `[db]` lines in the output say what is missing (server not running, client tools not on PATH, or a connection string that needs a user and password).

## Local development

`npm run dev` runs `scripts/db/ensure-local.mjs` first (the `predev` hook). It will:

1. Create `.env.local` from `.env.example` if you have no env file.
2. Check that Postgres is listening on the host/port in `DATABASE_URL`, and start the Homebrew service if it is installed but stopped.
3. Create the database named in `DATABASE_URL` if it does not exist.
4. Apply any pending migrations from `drizzle/`.

The default `DATABASE_URL` is `postgresql://localhost:5432/van_wyk_household`, which connects as your OS user (the Homebrew default). Set `SKIP_DB_ENSURE=1` to bypass the check, and note that the script does nothing when `DATABASE_URL` points at a non-local host.

Health check: `GET /api/health` returns the database's current time or a 503.

## Database workflow

All schema lives in `src/db/schema.ts`; all migrations live in `drizzle/` and are committed.

| Command | What it does |
| --- | --- |
| `npm run db:setup` | Same as the predev hook: ensure the local DB exists and is migrated |
| `npm run db:generate` | Diff the schema against the last snapshot and write a new SQL migration |
| `npm run db:migrate` | Apply pending migrations to `DATABASE_URL` |
| `npm run db:push` | Push schema directly without a migration file (local experiments only) |
| `npm run db:studio` | Open Drizzle Studio against `DATABASE_URL` |

Typical change: edit `src/db/schema.ts`, run `npm run db:generate -- --name <what_changed>`, review the SQL in `drizzle/`, commit both.

The client in `src/db/index.ts` picks a driver from the connection string: hosts ending in `.neon.tech` use Neon's HTTP driver (works in serverless and edge), everything else uses the plain `pg` TCP driver. Override with `DATABASE_DRIVER=neon` or `DATABASE_DRIVER=pg`.

## Vercel and Neon

`vercel.json` disables Vercel's Git integration outright (`git.deploymentEnabled: false`), so pushes never build or deploy, on any branch. As a second guard, the `ignoreCommand` skips the build step for any branch other than `main` should Git deployments ever be turned back on.

Deploys are manual, in one of two ways:

- **GitHub Actions**: run the "Deploy to Vercel (manual)" workflow from the Actions tab. It refuses to run off `main`, pulls production env from Vercel, runs migrations (toggle in the dispatch form), then builds and deploys with `vercel deploy --prebuilt --prod`. Needs repo secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` (the last two come from `.vercel/project.json` after `vercel link`).
- **CLI**: `npm run deploy` runs `vercel deploy --prod` from your machine. Run `npm run db:migrate` with the production `DATABASE_URL` first if the schema changed.

Neon setup: create the project, then either install the Neon integration on the Vercel project (it sets `DATABASE_URL`) or paste the pooled connection string into the Vercel project's production environment variables.
