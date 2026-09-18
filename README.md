# van-wyk-household

A household web app for two people: an **admin** who plans the week and an **employee** who works from their phone and ticks things off. It runs in the browser at one URL, on a phone and on a desktop. There is no native app and nothing to install from a store.

Four modules:

- **Tasks** — once-off and recurring, each with an assignee.
- **Menus** — lunch and dinner for every day, each marked "on the day" or "day before".
- **Groceries** — a weekly list that locks on Friday evening, is ordered on Monday, and carries out-of-stock items onto the next list.
- **Reminders** — a lock-day nudge and an order-day summary, by email and in the app.

Built with Next.js 16 (App Router, TypeScript, Tailwind v4) and Postgres via [Drizzle ORM](https://orm.drizzle.team). Local development runs against your own Postgres; production runs against [Neon](https://neon.tech) on Vercel.

The full v1 scope, including what is deliberately left out, is in [docs/scope.md](docs/scope.md).

## Prerequisites

- Node 20.11 or newer (`.nvmrc` says 22; `nvm use` picks it up).
- A Postgres server on your machine. The client tools (`psql`, `createdb`) are **not** required: the setup script talks to the server with the same driver the app uses.
  - macOS: `brew install postgresql@18 && brew services start postgresql@18`. Connects as your macOS user with no password, which matches the default `DATABASE_URL`.
  - Windows: install Postgres and start the service, then put the user and password into `DATABASE_URL`, e.g. `postgresql://postgres:postgres@localhost:5432/van_wyk_household`.
  - Anything else (Docker, a system package): set `DATABASE_URL` to match its host, port, user and password.

## First run after cloning

```bash
nvm use
npm install
npm run dev
```

Then create the household and your own admin account:

```bash
npm run db:seed
```

It asks for a household name, your name, your email and a password. Sign in at <http://localhost:3000>, then open **Settings** and add the person who works with you. **Their name is what the whole app shows from then on** — every screen, both theirs and yours, uses it.

To see the app with something in it before you put real data in:

```bash
npm run db:seed:demo
```

That fills in sample tasks, a two-week menu and two grocery lists. It deletes every task, meal and grocery list first, so do not run it once you are using the app for real.

## How the week works

- **Working days** default to Monday to Friday. The admin can mark any individual weekend date as a working day from the dashboard, and mark a weekday off the same way.
- **Recurring tasks** set to "working days only" follow that calendar, so a Saturday that gets marked as working picks up the normal daily tasks with nothing to re-create.
- **Day-before meal prep** lands on the last *working* day before the meal. A Monday dinner prepped in advance shows up on Friday when nobody works the weekend, and on Saturday when they do.
- **The grocery list** opens the moment the previous one locks, locks the following Friday at 18:00 household time, and is ordered on the Monday after that. Anything added after the lock lands on the next list automatically. The lock is enforced on the server by comparing the time, not by a scheduled job, so it cannot be missed.
- **Ordering** gives each item one of three outcomes: ordered, out of stock, or not needed. Out of stock moves the item onto a later list, keeping its quantity, its note and a count of how many times it has moved.

All of this is worked out in the household's own timezone, which is a setting.

## Local development

`npm run dev` runs `scripts/db/ensure-local.mjs` first (the `predev` hook). It will:

1. Create `.env.local` from `.env.example` if you have no env file.
2. Check that Postgres is answering on the host and port in `DATABASE_URL`, and start the Homebrew service if it is installed but stopped.
3. Create the database named in `DATABASE_URL` if it does not exist.
4. Apply any pending migrations from `drizzle/`.

Set `SKIP_DB_ENSURE=1` to bypass the check. The script does nothing when `DATABASE_URL` points at a non-local host.

Health check: `GET /api/health` returns the database's current time or a 503.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Ensure the local database, then start the dev server |
| `npm run build` | Production build (also generates the typed-route types) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:seed` | Create or update the household and the admin account |
| `npm run db:seed:demo` | Fill the database with sample data (destructive) |
| `npm run db:setup` | Same as the predev hook |
| `npm run db:generate` | Diff the schema and write a new SQL migration |
| `npm run db:migrate` | Apply pending migrations to `DATABASE_URL` |
| `npm run db:push` | Push schema without a migration file (local experiments only) |
| `npm run db:studio` | Open Drizzle Studio against `DATABASE_URL` |
| `npm run deploy` | `vercel deploy --prod` from your machine |

Run `npm run typecheck`, `npm run lint` and `npm run build` before committing; all three pass on a clean checkout. `typecheck` needs the types a build generates, so run a build first on a fresh clone.

## Environment

`.env.local` is git-ignored; `.env.example` is the committed template.

| Variable | Needed for |
| --- | --- |
| `DATABASE_URL` | Everything. Local Postgres, or the Neon string in production. |
| `AUTH_SECRET` | Signing the session cookie. Any long random string; changing it signs everyone out. |
| `RESEND_API_KEY`, `NOTIFY_FROM_EMAIL` | Email reminders. Without them the app still works and the in-app banner still appears. |
| `CRON_SECRET` | Protects `/api/reminders` so only the cron can trigger it. |

## Database workflow

All schema lives in `src/db/schema.ts`; all migrations live in `drizzle/` and are committed.

Typical change: edit `src/db/schema.ts`, run `npm run db:generate -- --name <what_changed>`, review the SQL in `drizzle/`, commit both.

The client in `src/db/index.ts` picks a driver from the connection string: hosts ending in `.neon.tech` use Neon's HTTP driver (works in serverless and edge), everything else uses the plain `pg` TCP driver. Override with `DATABASE_DRIVER=neon` or `DATABASE_DRIVER=pg`.

## Reminders

One Vercel Cron job hits `/api/reminders` daily at 07:00 UTC (09:00 SAST). The route works out the weekday in each household's own timezone and sends whichever reminder is due, so the schedule can move in Settings without a deploy. Every send is recorded in `notification_log` first, so re-running the route sends nothing twice.

## Vercel and Neon

`vercel.json` disables Vercel's Git integration outright (`git.deploymentEnabled: false`), so pushes never build or deploy, on any branch. As a second guard, the `ignoreCommand` skips the build step for any branch other than `main` should Git deployments ever be turned back on.

Deploys are manual, in one of two ways:

- **GitHub Actions**: run the "Deploy to Vercel (manual)" workflow from the Actions tab. It refuses to run off `main`, pulls production env from Vercel, runs migrations (toggle in the dispatch form), then builds and deploys with `vercel deploy --prebuilt --prod`. Needs repo secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` (the last two come from `.vercel/project.json` after `vercel link`).
- **CLI**: `npm run deploy` runs `vercel deploy --prod` from your machine. Run `npm run db:migrate` with the production `DATABASE_URL` first if the schema changed.

After the first production deploy, run `npm run db:seed` once against the production `DATABASE_URL` to create the admin account there.

Neon setup: create the project, then either install the Neon integration on the Vercel project (it sets `DATABASE_URL`) or paste the pooled connection string into the Vercel project's production environment variables.
