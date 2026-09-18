# van-wyk-household

A household web app for two roles: an **admin** who plans and an **employee** who works from their phone. Tasks with assignees, weekly menus with day-before prep, a grocery list that locks on Friday and carries out-of-stock items forward, and email reminders. Next.js 16 with Postgres through Drizzle ORM. Local dev uses the developer's own Postgres; production uses Neon on Vercel.

README.md has setup and the command table; `package.json` scripts are the source of truth for commands; `docs/scope.md` is the v1 scope and says what is deliberately out.

## Domain rules that are easy to get wrong

- **Never call the employee "the nanny" in the UI.** Every screen shows the person's own name, from the `users` row the admin created. Code that needs a label uses that name.
- **Calendar dates are `YYYY-MM-DD` strings** everywhere, which is what the Postgres `date` columns return. Real instants (the grocery lock, "now") are computed in the household's timezone with `@/lib/dates`, never in UTC and never in the server's zone.
- **Task occurrences are derived, never stored.** `@/lib/tasks` expands a rule over a date range on demand; only completions and skips are rows. That is why editing a rule changes the future without rewriting the past.
- **Working days are a calendar, not a weekday set.** `@/lib/workdays` merges the household default with per-date overrides. Recurring tasks and day-before meal prep both go through it, so a weekend day the admin marks as working behaves like any other working day.
- **The grocery lock is a comparison, not a job.** `isCycleOpen` compares now against the cycle's `locks_at`, so a missed cron can never leave a list open.

## Conventions

- **Schema changes are migrations.** Edit `src/db/schema.ts`, run `npm run db:generate -- --name <change>`, read the SQL it wrote in `drizzle/`, commit the schema and the migration together. `db:push` is for throwaway local experiments only; production is migrated from the committed files by the deploy workflow.
- **Import the database from `@/db`.** It picks the Neon HTTP driver for `*.neon.tech` hosts and the `pg` TCP driver otherwise, so one code path serves local and production. Its `db.execute()` result is typed `unknown` because of that union; prefer the query builder (`db.query.*`, `db.select()`), or cast to `{ rows: T[] }` as `src/app/api/health/route.ts` does.
- **Anything that reads the database at request time declares `export const dynamic = "force-dynamic"`.** Otherwise `next build` tries to prerender it and needs a live database at build time.
- **Env lives in `.env.local`, which is git-ignored.** `.env.example` is the committed template; update it when a new variable is introduced.
- **Deploys are manual and main-only by design.** `vercel.json` disables Git deployments and the GitHub Action is `workflow_dispatch`. Keep it that way; there are no preview deployments.

## Working here

- `npm run dev` runs `scripts/db/ensure-local.mjs` first (creates `.env.local`, the database, and applies migrations). It uses the `pg` driver rather than `psql`/`createdb`, so it needs no Postgres client tools on PATH. `SKIP_DB_ENSURE=1` bypasses it when Postgres is deliberately unavailable.
- Before committing, run `npm run typecheck`, `npm run lint` and `npm run build`; all three pass on a clean checkout. `typecheck` needs the route types a build generates, so build first on a fresh clone.
- **Every mutation is a server action that re-checks the role** with `requireViewer` or `requireAdmin` from `@/lib/auth`. Hiding a button in the UI is never the only guard.
- **Client components must not import `@/lib/groceries`, `@/lib/tasks`, `@/lib/meals`, `@/lib/workdays` or `@/lib/auth`** — they are `server-only` and pull in the database. Shared constants live in client-safe modules such as `@/lib/grocery-constants`.
- **Server components cannot pass functions to client components.** Icon components and the like are defined inside the client module that uses them; `@/components/nav` owns its own item lists for this reason.
- **Colors come from the tokens in `globals.css`**, which define a complete light palette on bare `:root` and redefine it for both `prefers-color-scheme: dark` and `[data-theme="dark"]`. Use the semantic Tailwind classes (`bg-surface`, `text-ink-2`, `border-line`, `text-accent`), never a raw hex, or one theme will break.
- **Two Tailwind width utilities on one element fight in the cascade.** `inputClass` already sets `w-full`; size a narrow input with `max-w-*` or a sized wrapper, not `w-*`.
- Next.js 16 differs from older training data. The note below points at the bundled docs; read the relevant page before using an API you are unsure of.

@AGENTS.md
