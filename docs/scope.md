# Nanny management app — scope (v1)

One household, two users. The **admin** (you) plans the week; the **employee** (the nanny) works from a phone and ticks things off. Four modules: tasks, menus, grocery list, reminders.

This is a **web app**: it runs in the browser at one URL, on the phone and on the desktop, with no native app and no app store. Built on the existing Next.js 16 + Drizzle + Postgres scaffold, deployed manually to Vercel as already set up.

Mockups of six screens: <https://claude.ai/artifact/LePRFyttb9Aq2nppeG6rkn>

Assumptions are listed at the end. The two that matter most: the household timezone is **Africa/Johannesburg**, and the Friday reminder goes out by **email plus an in-app banner**.

---

## 1. Users and roles

Two fixed roles. No self-signup: the admin is seeded by a script, and the admin creates the nanny's account from Settings.

| Capability | Admin | Employee |
| --- | --- | --- |
| Log in (email + password) | ✓ | ✓ |
| Create / edit / archive tasks | ✓ | – |
| Tick off own assigned tasks and prep items | ✓ | ✓ |
| Tick off anyone's tasks | ✓ | – |
| Mark weekend dates as working days | ✓ | – |
| Create / edit weekly menus | ✓ | – |
| View menus and prep instructions | ✓ | ✓ |
| Add grocery items while the list is open | ✓ | ✓ |
| Edit / remove grocery items | any item | own items only |
| Edit a locked grocery list, unlock, mark ordered | ✓ | – |
| Manage the nanny's account, reset password | ✓ | – |
| Household settings (timezone, reminder time) | ✓ | – |

**Auth recommendation:** Auth.js v5 with the Credentials provider and a JWT session cookie, passwords hashed with bcrypt. Two users do not justify a database session table. Every server action re-checks the role; the UI hiding a button is never the only guard.

---

## 2. Working days

The nanny works **Monday to Friday** by default, and occasionally on a weekend day when asked.

- The household has a default working-day set (Mon–Fri).
- The admin can mark any individual weekend date as a **working day**, from Settings or straight from the dashboard ("Working this Saturday"). It can be unmarked again.
- The nanny's Today view on a non-working day shows a short "Not a working day" note. Anything the admin has explicitly dated on that day (a once-off task, a meal) still shows, because the admin chose the date on purpose.
- Recurring tasks and day-before prep both respect working days, as described below.

---

## 3. Tasks

### Assignees
Every task has an **assignee**: the nanny or you. New tasks default to the nanny. Each person's Today view shows only their own tasks; the admin's dashboard shows both. The admin can tick anyone's task; the nanny can tick only her own.

### Once-off tasks
Title, optional notes, due date, optional time, assignee.

### Recurring tasks
Title, optional notes, assignee, and a rule:

| Frequency | Options |
| --- | --- |
| Daily | every working day (default), or every calendar day |
| Weekly | pick weekdays (e.g. Mon / Wed / Fri), every N weeks |
| Monthly | on day N of the month |

Plus a start date, optional end date, optional time of day.

"Every working day" includes any weekend date the admin has marked as working, so a Saturday she works in gets the normal daily tasks without anyone re-creating them. A weekly rule that lands on a non-working day is skipped, unless the task is assigned to the admin.

### How occurrences work
Occurrences are **computed from the rule when a date range is displayed**, not pre-generated. A completion is stored per `(task, date)`. This means:

- No background job is needed to "create tomorrow's tasks".
- Editing a rule changes future occurrences only; past completions keep their dates.
- The admin can **skip** a single date (e.g. public holiday) without touching the rule.
- Recurrence is hand-rolled for the three frequencies above. No `rrule` library; the rules are small and the library's edge cases are not worth it.

### Employee experience
- **Today** view: today's tasks plus any overdue once-off tasks, each with a checkbox. Ticking records who and when. Unticking is allowed on the same day.
- **Week** view: what is coming up, read-only.

### Admin experience
- Task list split into recurring and once-off, filterable by assignee, with edit / pause / archive.
- Completion history per task (date, time ticked, by whom) so you can see what was and was not done.

---

## 4. Menus

A week runs Monday to Sunday with two slots per day: **lunch** and **dinner**.

Each slot has:
- dish name
- optional notes (recipe link, portions, who eats what)
- **prep timing**: `on the day` or `day before`

### Admin
- Week editor: a 7 × 2 grid, edit in place.
- **Copy last week** to start from something rather than blank.
- Can plan next week ahead of time; current and next week are both visible.

### Employee
- Menu view for this week and next.
- Prep items appear on the nanny's **Today** checklist alongside tasks:
  - `day before` meals show on the previous day as "Prep tomorrow's dinner: lasagne".
  - `on the day` meals show on the day itself as "Make lunch: toasties".
- Ticking a prep item is stored like a task completion, so you can see it was done.

**Day-before prep on a non-working day** rolls back to the nanny's last working day. A Monday dinner marked `day before` becomes a Friday prep item, unless the admin has marked that Saturday or Sunday as a working day, in which case it lands there. The prep item says which meal it is for ("Prep Monday's dinner: lasagne") so the roll-back is never confusing.

---

## 5. Grocery list

### Cycles
The list runs in weekly **cycles** tied to the Monday you order on. A cycle:

- **opens** the moment the previous one locks (Friday 18:00),
- **locks** the following Friday at 18:00 household time,
- is **ordered** by you on the Monday after locking.

Anything added after Friday 18:00 automatically lands on the next cycle, so the nanny never has to "create a new list". The lock is enforced on the server by comparing the current time against the cycle's lock time, not by a scheduled job, so it cannot be missed.

### Items
Name, free-text quantity ("2 kg", "3 packs"), optional category (fresh, pantry, household, baby, other), optional note, who added it.

### Ordering on Monday
Once locked, the admin works through the list and gives each item one of three outcomes:

| Outcome | What happens |
| --- | --- |
| **Ordered** | Ticked. Done. |
| **Out of stock / couldn't buy** | The item is marked unavailable and **moved to the next cycle** in one tap. It keeps its quantity and note, and shows a "carried over" badge on the new list. A later cycle can be chosen instead of the next one. |
| **Not needed** | Removed from the list with a reason, so the nanny can see it was seen and dropped rather than forgotten. |

When every item has an outcome, the cycle is marked ordered.

### Reminders for carried-over items
- The next cycle's list opens with a **"Carried over from last week"** group at the top, so both of you see it immediately.
- The Monday email to the admin lists carried-over items separately: "3 items still to get from last week".
- If an item is carried over a second time, it shows the count ("carried twice") so a chronically unavailable item gets substituted rather than rolled forever.

### Rules
- Open cycle: both users add; the nanny edits and removes only her own items; the admin edits anything.
- Locked cycle: read-only for the nanny. The admin can still edit, and can **unlock** a cycle (an override flag) if the lock was premature.
- Moving an item to a later cycle is admin-only and works on locked and open cycles alike.
- Past cycles are kept and viewable by the admin, so you can see what was bought, what was unavailable and what was dropped in previous weeks.
- **Copy as text**: a one-tap export of the locked list as plain lines, for pasting into whichever shop app you order from.

---

## 6. Reminders

| When (household time) | Who | What |
| --- | --- | --- |
| Friday 09:00 | Employee | "Add anything you need for Monday's order before 18:00 today." |
| Friday, all day until 18:00 | Employee | In-app banner on every page with a countdown to the lock |
| Monday 09:00 | Admin | "Grocery list locked: N items to order, M carried over from last week." with the list |

### Mechanism
- One **Vercel Cron** job runs daily at 07:00 UTC (09:00 SAST) and hits a protected API route. The route looks at the weekday in household time and sends whichever reminder applies. One daily cron fits the Vercel Hobby plan limits; the weekday check happens in code.
- Email through **Resend** (free tier is plenty for two recipients).
- A `notification_log` table records what was sent for which date, so a re-run of the cron never sends duplicates.
- The in-app banner needs no infrastructure and works even if email fails.

Push notifications and WhatsApp are out of scope for v1. The reminder time is a household setting so it can be moved without a deploy.

---

## 7. Screens

**Shared**
- Login

**Employee (mobile-first, the primary surface)**
1. **Today** — her tasks, prep items, today's lunch and dinner, grocery banner on Fridays. This is the home screen.
2. **Tasks** — this week ahead.
3. **Menu** — this week and next.
4. **Groceries** — current cycle, add item, lock countdown.

**Admin**
1. **Dashboard** — this week at a glance: what was ticked, what was missed, per person; grocery cycle status; your own tasks for today; "working this weekend" toggle.
2. **Tasks** — manage recurring and once-off tasks, filter by assignee; completion history.
3. **Menus** — week editor with copy-last-week.
4. **Groceries** — current cycle, past cycles, order outcomes (ordered / out of stock / not needed), carry-over, copy-as-text, unlock.
5. **Settings** — nanny account, default working days, extra working dates, timezone, reminder time, notification emails.

The nanny opens the same URL in her phone's browser. A web manifest lets her add it to the home screen so it opens without browser chrome, but it is still the website; there is nothing to install from a store.

---

## 8. Data model

All tables hang off the existing `households` table. Timestamps are `timestamptz`; calendar dates (task due dates, meal dates, occurrence dates) are `date` columns interpreted in the household timezone.

| Table | Purpose | Key columns |
| --- | --- | --- |
| `households` | exists | add `timezone`, `working_weekdays[]` (default Mon–Fri), `grocery_lock_weekday`, `grocery_lock_time`, `reminder_time` |
| `users` | both people | `household_id`, `name`, `email`, `password_hash`, `role` (`admin` / `employee`) |
| `workday_overrides` | a weekend date marked working (or a weekday marked off) | `household_id`, `date`, `is_working`, `note`; unique on `(household_id, date)` |
| `tasks` | once-off and recurring | `title`, `notes`, `kind` (`once` / `recurring`), `due_date`, `frequency` (`daily` / `weekly` / `monthly`), `working_days_only`, `interval`, `weekdays[]`, `month_day`, `start_date`, `end_date`, `time_of_day`, `assigned_to` (user), `created_by`, `archived_at` |
| `task_completions` | one row per tick | `task_id`, `occurrence_date`, `completed_by`, `completed_at`; unique on `(task_id, occurrence_date)` |
| `task_skips` | admin skipped a single date | `task_id`, `occurrence_date` |
| `meals` | one row per slot per day | `date`, `slot` (`lunch` / `dinner`), `dish`, `notes`, `prep_timing` (`same_day` / `day_before`); unique on `(household_id, date, slot)` |
| `meal_completions` | prep or cooking ticked | `meal_id`, `completed_by`, `completed_at` |
| `grocery_cycles` | one per ordering Monday | `order_date`, `locks_at`, `unlocked_by_admin`, `ordered_at` |
| `grocery_items` | list lines | `cycle_id`, `name`, `quantity`, `category`, `note`, `added_by`, `status` (`pending` / `ordered` / `unavailable` / `dropped`), `carried_from_item_id`, `carry_count`, `resolved_at` |
| `notification_log` | idempotent reminders | `kind`, `sent_for_date`, `recipient_user_id`, `sent_at` |

Each table lands as a committed migration per the repo convention.

---

## 9. Technical notes

- **Mutations** are Next.js server actions; every action loads the session and checks the role.
- **Pages that read the database** declare `force-dynamic` as the repo already requires.
- **Dates**: `date-fns` plus `@date-fns/tz` for household-timezone arithmetic. "Friday 18:00" is always computed in the household zone, never in UTC or the server's zone.
- **New env vars**: `AUTH_SECRET`, `RESEND_API_KEY`, `CRON_SECRET`, `NOTIFY_FROM_EMAIL`. Each goes into `.env.example`.
- **New dependencies**: `next-auth@beta`, `bcryptjs`, `resend`, `date-fns`, `@date-fns/tz`.
- **Seeding**: a `scripts/db/seed-admin.mjs` that creates the household and the admin user from env values, run once locally and once against production.

---

## 10. Out of scope for v1

- More than one nanny or more than one household in the UI (the schema allows it; the screens do not).
- Hours, leave, payroll.
- Recipes and automatic ingredient-to-grocery generation.
- Staple items that auto-add every week (small, good candidate for v1.1).
- Native iOS / Android apps, push notifications, WhatsApp, SMS.
- Child profiles, medical or emergency info.
- Photo attachments.

---

## 11. Delivery phases

Each phase is deployable on its own and lands on production through the existing manual deploy.

| Phase | Delivers | Depends on |
| --- | --- | --- |
| 0 | Auth, users table, role guard, app shell with navigation, admin seed script, working days | – |
| 1 | Tasks: once-off, recurring, assignees, Today view, completions, history | 0 |
| 2 | Menus: week editor, copy-last-week, prep items on Today | 1 |
| 3 | Groceries: cycles, lock logic, admin unlock, order outcomes, carry-over to next cycle, copy-as-text | 0 |
| 4 | Reminders: cron route, Resend email, notification log, Friday banner | 3 |
| 5 | Polish: manifest / add-to-home-screen, dashboard, empty states | 1–4 |

Phase 3 can run in parallel with 1 and 2.

---

## 12. Open questions and assumptions

Settled:

- **Working days** are Mon–Fri, with individual weekend dates the admin can mark as working.
- **Tasks have assignees**: the nanny or the admin. Default is the nanny.
- **Web app only**: browser on phone and desktop, no native app.

Decisions I have made that you can overturn:

1. **Timezone** is Africa/Johannesburg. Stored as a household setting.
2. **Reminder channel** is email plus in-app banner. If the nanny does not use email, the banner alone still works, and WhatsApp can be added later.
3. **Reminder time** is Friday 09:00 for the nanny and Monday 09:00 for you.
4. **One order per week**, placed on Monday. The cycle model assumes this.
5. **Menus cover lunch and dinner only.** Breakfast is not a slot.
6. **The nanny can unlock nothing.** Only the admin can edit after Friday 18:00.
7. **Day-before prep on a non-working day rolls back** to the last working day rather than being dropped.

Questions I could not settle from the brief:

8. **Should the nanny see next week's menu**, or only the current week? Assumed yes, so she can prep on Friday for Monday if needed.
9. **Should ticked tasks be editable the next day?** Assumed no: a completion can be undone on the same day only, to keep the history honest.
