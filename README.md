# van-wyk-household

Next.js 16 (App Router, TypeScript, Tailwind) with Postgres via [Drizzle ORM](https://orm.drizzle.team). Local development runs against your own Postgres; production runs against [Neon](https://neon.tech) on Vercel.

## Local development

```bash
npm install
npm run dev
```

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
