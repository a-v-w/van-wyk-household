# van-wyk-household

A household web app for a household of any size: **admins** plan, **everyone else** works from their phone. Two roles, as many people in each as you like. Tasks with assignees, attendance (worked / off / sick / leave), weekly menus with several dishes per slot and day-before prep, a recipe book, a grocery list that locks on Friday and carries out-of-stock items forward, and email reminders. Next.js 16 with Postgres through Drizzle ORM. Local dev uses the developer's own Postgres; production uses Neon on Vercel.

README.md has setup and the command table; `package.json` scripts are the source of truth for commands; `docs/scope.md` is the v1 scope and says what is deliberately out.

## Domain rules that are easy to get wrong

- **Never call anyone by their role in the UI.** Every screen shows the person's own name, from their `users` row. A household holds as many people as it likes, each with a login, their own tasks and their own attendance; `job_title` is a free-text label, never an identity.
- **Calendar dates are `YYYY-MM-DD` strings** everywhere, which is what the Postgres `date` columns return. Real instants (the grocery lock, "now") are computed in the household's timezone with `@/lib/dates`, never in UTC and never in the server's zone.
- **Task occurrences are derived, never stored.** `@/lib/tasks` expands a rule over a date range on demand; only completions and skips are rows. That is why editing a rule changes the future without rewriting the past.
- **Working days are a calendar, not a weekday set, and they belong to a person.** `@/lib/workdays` merges the household default with that person's per-date records, whose status is `working`, `off`, `sick` or `leave`. Only `working` counts. Load several people at once with `loadCalendars`, which returns a `CalendarSet`: `for(userId)` gives one person's days, and `anyoneWorking` / `previousWorkingDay` answer for the household, which is what kitchen prep uses since a meal belongs to nobody in particular. A task is always expanded against its own assignee's calendar.
- **A date with no record follows the pattern.** `setDayStatus` deletes the record when the chosen status matches what the weekday would give anyway and there is no note, so the table holds only real exceptions. Attendance counts stop at today; `scheduled` counts the whole range so a future month still reads sensibly.
- **A meal slot holds several dishes.** `meals` has no unique constraint on `(date, slot)`; each row is one dish with an optional `for_whom` and `recipe_id`. A slot with no rows renders nothing at all — never an empty placeholder. `replaceSlot` makes a slot match a submitted list, deleting what is missing.
- **The grocery lock is a comparison, not a job.** `isCycleOpen` compares now against the cycle's `locks_at`, so a missed cron can never leave a list open. The lock binds the employee only: the admin can add to, edit and remove from any list at any time.

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
- **Client components must not import `@/lib/groceries`, `@/lib/tasks`, `@/lib/meals`, `@/lib/workdays`, `@/lib/recipes` or `@/lib/auth`** — they are `server-only` and pull in the database. Shared constants live in client-safe modules: `@/lib/grocery-constants`, `@/lib/workday-constants`.
- **Restart the dev server after a schema change.** `@/db` caches the Drizzle client on `globalThis` across hot reloads, and that client binds the table definitions it was built with, so a new column reads as missing until the process restarts.
- **Server components cannot pass functions to client components.** Icon components and the like are defined inside the client module that uses them; `@/components/nav` owns its own item lists for this reason.
- **Colors come from the tokens in `globals.css`**, which define a complete light palette on bare `:root` and redefine it for both `prefers-color-scheme: dark` and `[data-theme="dark"]`. Use the semantic Tailwind classes (`bg-surface`, `text-ink-2`, `border-line`, `text-accent`), never a raw hex, or one theme will break.
- **Two Tailwind width utilities on one element fight in the cascade.** `inputClass` already sets `w-full`; size a narrow input with `max-w-*` or a sized wrapper, not `w-*`.
- **Textarea content arrives with CRLF.** Browsers normalise it on submit, so anything that splits stored prose on blank lines must go through `normaliseLines` first, and the action normalises before writing. Recipe steps silently merged into one until this was fixed.
- **The `label` class uppercases its text**, and `innerText` honours that. A test that greps rendered text for a label must compare case-insensitively.
- Next.js 16 differs from older training data. The note below points at the bundled docs; read the relevant page before using an API you are unsure of.

@AGENTS.md
