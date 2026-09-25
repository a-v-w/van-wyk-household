"use client";

import Link from "next/link";
import { AttendanceTally } from "@/components/attendance-tally";
import { PageError, PageSkeleton } from "@/components/skeleton";
import { TaskRow } from "@/components/task-list";
import {
  Avatar,
  Card,
  CardHeader,
  Chip,
  Empty,
  IconArrowRight,
  IconLock,
  StatTile,
  buttonClass,
} from "@/components/ui";
import { WorkdayStrip } from "@/components/workday-strip";
import { useClientData } from "@/lib/client-data";
import { formatDate, formatDayDate, formatLongDate } from "@/lib/dates";
import type { AdminDashboardData } from "@/lib/page-data/admin-dashboard";
import { STATUS_LABEL } from "@/lib/workday-constants";

function percent(done: number, total: number): number {
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

export function AdminDashboard() {
  const { data, error, refresh } = useClientData<AdminDashboardData>(
    "/api/admin/dashboard",
  );

  if (error && !data) return <PageError message={error} onRetry={refresh} />;
  if (!data) return <PageSkeleton variant="admin" cards={4} />;

  const { today, tasks, grocery, kitchen } = data;

  return (
    <div className="flex flex-col gap-6 px-5 py-6 lg:px-8 lg:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="font-mono text-xs tracking-widest text-muted uppercase">
            {formatLongDate(today)}
          </p>
          <h1 className="text-3xl leading-tight font-extrabold tracking-tight">
            This week
          </h1>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/tasks/new" className={buttonClass("primary")}>
            New task
          </Link>
          <Link href="/admin/menus" className={buttonClass("secondary")}>
            Plan the menu
          </Link>
        </div>
      </header>

      {data.weekStrips.length === 0 ? (
        <Card>
          <Empty
            title="Nobody works here yet"
            hint="Add the people who do in Settings, and their weeks appear here."
          />
        </Card>
      ) : (
        <Card className="flex flex-col gap-5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="label">
              The week · {formatDate(data.monday)} to {formatDate(data.weekEnd)}
            </span>
            <span className="text-[13px] text-muted">
              Click a day to record whether it was worked, off, sick or leave.
            </span>
          </div>
          {data.weekStrips.map(({ person, days }) => (
            <div key={person.id} className="flex flex-col gap-2">
              {data.weekStrips.length > 1 ? (
                <div className="flex items-center gap-2">
                  <Avatar name={person.name} role={person.role} size="sm" />
                  <span className="text-sm font-bold">{person.name}</span>
                  {person.jobTitle ? <Chip>{person.jobTitle}</Chip> : null}
                </div>
              ) : null}
              <WorkdayStrip days={days} />
            </div>
          ))}
        </Card>
      )}

      {data.attendance.map(({ person, summary }) => (
        <Card key={person.id} className="flex flex-col p-5">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <span className="label">
              Attendance · {data.monthLabel} · {person.name}
            </span>
            <Link
              href={`/admin/attendance?who=${person.id}`}
              className="text-[13px] font-bold text-accent"
            >
              Open attendance
            </Link>
          </div>

          <AttendanceTally attendance={summary} />

          {summary.exceptions.length > 0 ? (
            <div className="mt-4 flex flex-col gap-2 border-t border-line pt-3">
              <span className="label">Days that were different</span>
              <ul className="flex flex-col gap-1.5">
                {summary.exceptions.slice(0, 6).map((entry) => (
                  <li
                    key={entry.date}
                    className="flex flex-wrap items-center gap-2 text-sm"
                  >
                    <span className="font-mono text-xs text-muted tabular">
                      {formatDayDate(entry.date)}
                    </span>
                    <Chip
                      tone={
                        entry.status === "sick"
                          ? "danger"
                          : entry.status === "leave"
                            ? "lock"
                            : entry.status === "working"
                              ? "accent"
                              : "neutral"
                      }
                    >
                      {STATUS_LABEL[entry.status]}
                    </Chip>
                    {entry.date > today ? (
                      <span className="text-xs text-muted">
                        still to come, so not counted yet
                      </span>
                    ) : null}
                    {entry.note ? (
                      <span className="min-w-0 flex-1 truncate text-ink-2">
                        {entry.note}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-4 border-t border-line pt-3 text-sm text-muted">
              Nothing out of the ordinary this month.
            </p>
          )}
        </Card>
      ))}

      {/* Tasks: what is done, what is not, today and across the week. */}
      <Card className="flex flex-col p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <span className="label">Tasks</span>
          <Link
            href="/admin/tasks"
            className="text-[13px] font-bold text-accent"
          >
            Manage tasks
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            label="Completed today"
            value={`${tasks.completedToday} / ${tasks.todayTotal}`}
            hint={`${percent(tasks.completedToday, tasks.todayTotal)}% of today's list`}
            tone={
              tasks.todayTotal > 0 && tasks.completedToday === tasks.todayTotal
                ? "ok"
                : undefined
            }
          />
          <StatTile
            label="Outstanding today"
            value={tasks.outstandingToday}
            hint={
              tasks.outstandingToday === 0 ? "Nothing left" : "Still to be ticked"
            }
            tone={tasks.outstandingToday > 0 ? "accent" : "ok"}
          />
          <StatTile
            label="Completed this week"
            value={`${tasks.weekDone} / ${tasks.weekDue}`}
            hint={
              tasks.weekToCome > 0
                ? `${tasks.weekToCome} more still to come`
                : "The week is fully due"
            }
          />
          <StatTile
            label="Missed"
            value={tasks.missed}
            hint="Earlier this week, never ticked"
            tone={tasks.missed > 0 ? "danger" : "ok"}
          />
        </div>

        {/* Who is carrying what, across the days that have come due. */}
        <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4">
          {tasks.perPerson.map(
            ({ person, label, done, total, upcoming, todayDone, todayTotal }) => (
              <div key={person.id} className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2 text-sm font-bold">
                  <Avatar name={person.name} role={person.role} size="sm" />
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                  <span className="font-mono text-xs text-muted tabular">
                    today {todayDone} / {todayTotal} · week {done} / {total}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-3">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${percent(done, total)}%` }}
                  />
                </div>
                {upcoming > 0 ? (
                  <span className="text-xs text-muted">
                    {upcoming} still to come later this week
                  </span>
                ) : null}
              </div>
            ),
          )}
        </div>

        <div className="mt-4 grid gap-4 border-t border-line pt-4 lg:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="label">Outstanding today</span>
              <span className="font-mono text-xs text-muted tabular">
                {tasks.outstandingRows.length}
              </span>
            </div>
            <div className="overflow-hidden rounded-lg border border-line">
              {tasks.outstandingRows.length === 0 ? (
                <Empty title="Everything today is ticked" className="py-7" />
              ) : (
                <ul className="max-h-96 overflow-y-auto">
                  {tasks.outstandingRows.map((row) => (
                    <TaskRow key={`out-${row.taskId}:${row.date}`} row={row} />
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="label">Completed today</span>
              <span className="font-mono text-xs text-muted tabular">
                {tasks.completedRows.length}
              </span>
            </div>
            <div className="overflow-hidden rounded-lg border border-line">
              {tasks.completedRows.length === 0 ? (
                <Empty title="Nothing ticked off yet today" className="py-7" />
              ) : (
                <ul className="max-h-96 overflow-y-auto">
                  {tasks.completedRows.map((row) => (
                    <TaskRow key={`done-${row.taskId}:${row.date}`} row={row} />
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {tasks.missedRows.length > 0 ? (
          <div className="mt-4 flex flex-col gap-2 border-t border-line pt-4">
            <div className="flex items-baseline justify-between gap-2">
              <span className="label text-danger">Missed earlier this week</span>
              <Link
                href="/admin/missed"
                className="text-xs font-bold text-accent hover:underline"
              >
                Catch up
              </Link>
            </div>
            <ul className="flex flex-wrap gap-x-5 gap-y-1.5">
              {tasks.missedRows.slice(0, 10).map((row) => (
                <li key={row.key} className="flex items-center gap-2 text-sm">
                  <span className="font-mono text-xs text-muted tabular">
                    {row.weekday}
                  </span>
                  <span>{row.title}</span>
                  {row.by ? (
                    <span className="text-xs text-muted">{row.by}</span>
                  ) : null}
                </li>
              ))}
              {tasks.missedRows.length > 10 ? (
                <li className="text-sm text-muted">
                  and {tasks.missedRows.length - 10} more
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="flex flex-col">
          <CardHeader
            title={grocery ? grocery.name : "Grocery list"}
            action={
              grocery?.closes ? (
                grocery.closes.today ? (
                  <Chip tone="lock">
                    <IconLock size={14} />
                    {grocery.closes.label}
                  </Chip>
                ) : (
                  <Chip>{grocery.closes.label}</Chip>
                )
              ) : (
                <Chip>Always open</Chip>
              )
            }
          />
          <div className="flex flex-1 flex-col gap-3 px-5 pt-1 pb-5">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-4xl leading-none font-bold tabular">
                {grocery?.pendingCount ?? 0}
              </span>
              <span className="text-sm text-ink-2">
                {grocery?.pendingLabel ?? "items waiting"}
              </span>
            </div>

            <div className="flex flex-col gap-1 text-sm">
              {grocery?.byPerson.map((entry) => (
                <div key={entry.id} className="flex justify-between">
                  <span>{entry.label}</span>
                  <span className="font-mono text-ink-2 tabular">
                    {entry.count}
                  </span>
                </div>
              ))}
              {grocery && grocery.carried > 0 ? (
                <div className="flex justify-between text-lock">
                  <span>Of those, carried over</span>
                  <span className="font-mono tabular">{grocery.carried}</span>
                </div>
              ) : null}
            </div>

            <div className="mt-auto flex flex-wrap gap-2 pt-2">
              <Link
                href="/admin/groceries"
                className={buttonClass("secondary", "sm")}
              >
                Open the list
              </Link>
              {grocery?.order ? (
                <Link
                  href="/admin/groceries"
                  className={buttonClass("primary", "sm")}
                >
                  {grocery.order.label}
                  <IconArrowRight size={16} />
                </Link>
              ) : null}
            </div>
          </div>
        </Card>

        <Card className="flex flex-col">
          <CardHeader
            title="Meals today"
            action={
              <Link
                href="/admin/menus"
                className="text-[13px] font-bold text-accent"
              >
                Edit menu
              </Link>
            }
          />
          {kitchen.slots.length === 0 && kitchen.prepAhead.length === 0 ? (
            <Empty
              title="No menu set for today"
              hint="Plan the week and the kitchen list fills itself in."
            />
          ) : (
            <ul>
              {/* Grouped by slot, so every lunch sits together. */}
              {kitchen.slots.flatMap((group) =>
                group.entries.map((meal, index) => (
                  <li
                    key={meal.id}
                    className="flex items-center gap-3 border-b border-line px-5 py-3 text-sm last:border-b-0"
                  >
                    <span className="label w-14 flex-none">
                      {index === 0 ? group.label : ""}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-semibold">
                      {meal.dish}
                    </span>
                    {meal.forWhom ? (
                      <Chip tone="accent">for {meal.forWhom}</Chip>
                    ) : null}
                    {meal.prepTiming === "day_before" ? (
                      <Chip tone={meal.prepDone ? "ok" : "lock"}>
                        {meal.prepDone ? "Prepped" : "Prep missed"}
                      </Chip>
                    ) : (
                      <Chip>On the day</Chip>
                    )}
                  </li>
                )),
              )}
              {kitchen.prepAhead.map((meal) => (
                <li
                  key={`prep-${meal.id}`}
                  className="flex items-center gap-3 border-b border-line bg-surface-2/60 px-5 py-3 text-sm last:border-b-0"
                >
                  <span className="label w-14 flex-none">Prep</span>
                  <span className="min-w-0 flex-1 truncate font-semibold">
                    {meal.title}
                  </span>
                  <Chip tone={meal.prepDone ? "ok" : "accent"}>
                    {meal.prepDone ? "Done" : "Day-before prep"}
                  </Chip>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
