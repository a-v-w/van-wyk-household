"use client";

import Link from "next/link";
import { LockBanner } from "@/components/lock-banner";
import { PageError, PageSkeleton } from "@/components/skeleton";
import { PrepRow, TaskRow } from "@/components/task-list";
import { Card, Chip, Empty, IconBook, IconCalendar } from "@/components/ui";
import { useClientData } from "@/lib/client-data";
import type { TodayData } from "@/lib/page-data/today";

export function TodayPage() {
  const { data, error, refresh } = useClientData<TodayData>("/api/today");

  if (error && !data) return <PageError message={error} onRetry={refresh} />;
  if (!data) return <PageSkeleton variant="employee" cards={3} />;

  const { working, lockBanner, tasks } = data;

  return (
    <div className="flex flex-col gap-5 px-4 pt-2 pb-8">
      <header className="flex flex-col gap-1 px-1">
        <p className="font-mono text-xs tracking-widest text-muted uppercase">
          {data.dateLabel}
        </p>
        <h1 className="text-[28px] leading-tight font-extrabold tracking-tight">
          Today
        </h1>
      </header>

      {lockBanner ? (
        <LockBanner
          listName={lockBanner.listName}
          locksAt={lockBanner.locksAt}
          timeLabel={lockBanner.timeLabel}
          orderDate={lockBanner.orderDate}
          itemCount={lockBanner.itemCount}
          href={lockBanner.href}
        />
      ) : null}

      {!working ? (
        <div className="flex items-center gap-2.5 rounded-xl bg-surface-2 px-4 py-3">
          <IconCalendar size={18} className="flex-none text-muted" />
          <p className="text-[13px] text-ink-2">
            {data.weekday} is not a working day. Anything below was put there
            for this date on purpose.
          </p>
        </div>
      ) : null}

      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between px-1">
          <h2 className="label">Your tasks</h2>
          {tasks.total > 0 ? (
            <span className="font-mono text-xs text-muted tabular">
              {tasks.done} of {tasks.total} done
            </span>
          ) : null}
        </div>
        <Card>
          {tasks.rows.length === 0 ? (
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
              {tasks.rows.map((row) => (
                <TaskRow key={`${row.taskId}:${row.date}`} row={row} />
              ))}
            </ul>
          )}
        </Card>
      </section>

      {data.prepAhead.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="label px-1">Prep for later</h2>
          <Card>
            <ul>
              {data.prepAhead.map((row) => (
                <PrepRow key={row.mealId} row={row} />
              ))}
            </ul>
          </Card>
        </section>
      ) : null}

      {/* Only slots with something in them appear, so an unplanned lunch is
          simply absent rather than an empty row. */}
      {data.mealSlots.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="label px-1">Meals today</h2>
          <Card>
            {data.mealSlots.map((group) => (
              <div
                key={group.slot}
                className="border-b border-line last:border-b-0"
              >
                <div className="label px-4 pt-3 pb-1">{group.label}</div>
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
