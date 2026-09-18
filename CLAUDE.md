# van-wyk-household

Next.js 16 app with Postgres through Drizzle ORM. Local dev uses the developer's own Postgres; production will use Neon on Vercel. README.md has setup and the command table; `package.json` scripts are the source of truth for commands.

## Conventions

- **Schema changes are migrations.** Edit `src/db/schema.ts`, run `npm run db:generate -- --name <change>`, read the SQL it wrote in `drizzle/`, commit the schema and the migration together. `db:push` is for throwaway local experiments only; production is migrated from the committed files by the deploy workflow.
- **Import the database from `@/db`.** It picks the Neon HTTP driver for `*.neon.tech` hosts and the `pg` TCP driver otherwise, so one code path serves local and production. Its `db.execute()` result is typed `unknown` because of that union; prefer the query builder (`db.query.*`, `db.select()`), or cast to `{ rows: T[] }` as `src/app/api/health/route.ts` does.
- **Anything that reads the database at request time declares `export const dynamic = "force-dynamic"`.** Otherwise `next build` tries to prerender it and needs a live database at build time.
- **Env lives in `.env.local`, which is git-ignored.** `.env.example` is the committed template; update it when a new variable is introduced.
- **Deploys are manual and main-only by design.** `vercel.json` disables Git deployments and the GitHub Action is `workflow_dispatch`. Keep it that way; there are no preview deployments.

## Working here

- `npm run dev` runs `scripts/db/ensure-local.mjs` first (creates `.env.local`, the database, and applies migrations). `SKIP_DB_ENSURE=1` bypasses it when Postgres is deliberately unavailable.
- Before committing, run `npm run typecheck`, `npm run lint` and `npm run build`; all three pass on a clean checkout.
- Next.js 16 differs from older training data. The note below points at the bundled docs; read the relevant page before using an API you are unsure of.

@AGENTS.md
