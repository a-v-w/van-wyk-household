import type { Metadata } from "next";
import Link from "next/link";
import { LockBanner } from "@/components/lock-banner";
import { PrepRow, TaskRow } from "@/components/task-list";
import { Card, Chip, Empty, IconBook, IconCalendar } from "@/components/ui";
import { requireViewer } from "@/lib/auth";
import {
  formatLongDate,
  formatTime,
  relativeDay,
  todayIn,
  weekdayName,
  type IsoDate,
} from "@/lib/dates";
import {
  currentCycle,
  currentLockDate,
  loadCycleView,
  resolveList,
} from "@/lib/groceries";
import { loadDayKitchen, SLOT_LABEL } from "@/lib/meals";
import { describeRule, loadOccurrences } from "@/lib/tasks";
import { loadCalendars } from "@/lib/workdays";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Today" };

export default async function TodayPage() {
  const viewer = await requireViewer();
  const { household, user } = viewer;
  const today: IsoDate = todayIn(household.timezone);

  const calendars = await loadCalendars(household, [user.id], today, today);
  const calendar = calendars.for(user.id);
  const working = calendar.isWorking(today);

  const [occurrences, kitchen, list] = await Promise.all([
    loadOccurrences({
      householdId: household.id,
      from: today,
      to: today,
      calendars,
      assigneeId: user.id,
      includeOverdue: true,
    }),
    loadDayKitchen(household.id, today, calendars),
    resolveList(household),
  ]);

  // Only the list that closes today nudges, and only before it closes.
  const cycle = list ? await currentCycle(household, list) : null;
  const view = cycle && list ? await loadCycleView(list, cycle) : null;
  const showLockBanner =
    Boolean(list) &&
    list.kind === "weekly" &&
    currentLockDate(household, list) === today;
  const pendingCount =
    view?.items.filter((i) => i.status === "pending").length ?? 0;

  const done = occurrences.filter((o) => o.done).length;
  const total = occurrences.length;

  return (
    <div className="flex flex-col gap-5 px-4 pt-2 pb-8">
      <header className="flex flex-col gap-1 px-1">
        <p className="font-mono text-xs tracking-widest text-muted uppercase">
          {formatLongDate(today)}
        </p>
        <h1 className="text-[28px] leading-tight font-extrabold tracking-tight">
          Today
        </h1>
      </header>

      {showLockBanner && view?.locksAt && list && cycle ? (
        <LockBanner
          listName={list.name}
          locksAt={view.locksAt}
          orderDate={cycle.orderDate}
          itemCount={pendingCount}
          href={`/groceries?list=${list.id}`}
        />
      ) : null}

      {!working ? (
        <div className="flex items-center gap-2.5 rounded-xl bg-surface-2 px-4 py-3">
          <IconCalendar size={18} className="flex-none text-muted" />
          <p className="text-[13px] text-ink-2">
            {weekdayName(today)} is not a working day. Anything below was put
            there for this date on purpose.
          </p>
        </div>
      ) : null}

      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between px-1">
          <h2 className="label">Your tasks</h2>
          {total > 0 ? (
            <span className="font-mono text-xs text-muted tabular">
              {done} of {total} done
            </span>
          ) : null}
        </div>
        <Card>
          {occurrences.length === 0 ? (
            <Empty
              title={working ? "Nothing on your list today" : "No tasks today"}
              hint={
                working
                  ? "New tasks appear here as soon as they are added."
                  : undefined
              }
            />
          ) : (
            <ul>
              {occurrences.map((o) => (
                <TaskRow
                  key={`${o.task.id}:${o.date}`}
                  row={{
                    taskId: o.task.id,
                    date: o.date,
                    title: o.task.title,
                    notes: o.task.notes,
                    done: o.done,
                    time: formatTime(o.task.timeOfDay) || null,
                    rule:
                      o.task.kind === "recurring" ? describeRule(o.task) : null,
                    overdue: o.overdue,
                    assigneeName: null,
                    showAssignee: false,
                    canTick: true,
                    completedLabel: o.completedAt
                      ? `Done ${o.completedAt.toLocaleTimeString("en-ZA", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                          timeZone: household.timezone,
                        })}`
                      : null,
                  }}
                />
              ))}
            </ul>
          )}
        </Card>
      </section>

      {kitchen.prepAhead.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="label px-1">Prep for later</h2>
          <Card>
            <ul>
              {kitchen.prepAhead.map((meal) => (
                <PrepRow
                  key={meal.id}
                  row={{
                    mealId: meal.id,
                    title: `Prep ${weekdayName(meal.date).toLowerCase()}'s ${meal.slot}${
                      meal.forWhom ? ` for ${meal.forWhom}` : ""
                    }: ${meal.dish}`,
                    notes: meal.notes,
                    done: meal.prepDone,
                    chip: `For ${relativeDay(meal.date, today).toLowerCase()}`,
                    rolledBackFrom: meal.rolledBack
                      ? `the day before ${weekdayName(meal.date).toLowerCase()}`
                      : null,
                    canTick: true,
                  }}
                />
              ))}
            </ul>
          </Card>
        </section>
      ) : null}

      {/* Only slots with something in them appear, so an unplanned lunch is
          simply absent rather than an empty row. */}
      {kitchen.todayBySlot.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="label px-1">Meals today</h2>
          <Card>
            {kitchen.todayBySlot.map((group) => (
              <div
                key={group.slot}
                className="border-b border-line last:border-b-0"
              >
                <div className="label px-4 pt-3 pb-1">
                  {SLOT_LABEL[group.slot]}
                </div>
                <ul>
                  {group.entries.map((meal) => (
                    <li
                      key={meal.id}
                      className="flex flex-col gap-1 px-4 pt-1 pb-3.5"
                    >
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span className="text-[15px] leading-snug font-bold">
                          {meal.dish}
                        </span>
                        {meal.forWhom ? (
                          <Chip tone="accent">for {meal.forWhom}</Chip>
                        ) : null}
                      </div>
                      {meal.notes ? (
                        <span className="text-[13px] leading-snug text-ink-2">
                          {meal.notes}
                        </span>
                      ) : null}
                      {meal.recipeId ? (
                        <Link
                          href={`/recipes/${meal.recipeId}`}
                          className="inline-flex items-center gap-1 self-start rounded-full border border-accent-line bg-accent-soft px-2.5 py-0.5 text-xs font-bold text-accent"
                        >
                          <IconBook size={13} />
                          Recipe
                          </Link>
                        ) : null}
                      <div className="flex flex-wrap gap-1.5">
                        {meal.prepTiming === "day_before" ? (
                          <Chip tone={meal.prepDone ? "ok" : "lock"}>
                            {meal.prepDone
                              ? "Prepped in advance"
                              : "Should have been prepped"}
                          </Chip>
                        ) : (
                          <Chip>Make on the day</Chip>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </Card>
        </section>
      ) : null}

    </div>
  );
}
