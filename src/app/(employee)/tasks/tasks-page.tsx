"use client";

import { useState } from "react";
import { PageError, PageSkeleton } from "@/components/skeleton";
import { TaskRow } from "@/components/task-list";
import { Card, Chip, Empty, cn } from "@/components/ui";
import { useClientData } from "@/lib/client-data";
import type { TasksData } from "@/lib/page-data/tasks";

type View = "upcoming" | "missed";

export function TasksPage() {
  const { data, error, refresh } = useClientData<TasksData>("/api/tasks");
  const [view, setView] = useState<View>("upcoming");

  if (error && !data) return <PageError message={error} onRetry={refresh} />;
  if (!data) return <PageSkeleton variant="employee" cards={3} />;

  const missed = data.missedTotal;

  return (
    <div className="flex flex-col gap-5 px-4 pt-2 pb-8">
      <header className="flex flex-col gap-1 px-1">
        <p className="font-mono text-xs tracking-widest text-muted uppercase">
          {view === "upcoming" ? "Next two weeks" : "Not done yet"}
        </p>
        <h1 className="text-[28px] leading-tight font-extrabold tracking-tight">
          Your tasks
        </h1>
      </header>

      <div className="flex overflow-hidden rounded-lg border border-line-strong">
        {(
          [
            ["upcoming", "Coming up", data.total],
            ["missed", "Missed", missed],
          ] as const
        ).map(([option, label, count]) => (
          <button
            key={option}
            type="button"
            onClick={() => setView(option)}
            aria-pressed={view === option}
            className={cn(
              "flex flex-1 cursor-pointer items-center justify-center gap-2 py-2.5 text-sm font-bold transition-colors",
              view === option
                ? "bg-accent text-accent-ink"
                : "bg-surface text-ink-2 hover:bg-surface-2",
            )}
          >
            {label}
            {count > 0 ? (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[11px] leading-none font-extrabold tabular",
                  view === option
                    ? "text-accent-ink"
                    : option === "missed"
                      ? "bg-danger-soft text-danger"
                      : "bg-surface-2 text-muted",
                )}
              >
                {count}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {view === "upcoming" ? (
        data.total === 0 ? (
          <Card>
            <Empty
              title="Nothing scheduled"
              hint="Tasks the household adds for you will show up here."
            />
          </Card>
        ) : (
          data.days.map((day) => (
            <section key={day.date} className="flex flex-col gap-2">
              <div className="flex items-center gap-2 px-1">
                <h2 className="label">{day.heading}</h2>
                <span className="font-mono text-xs text-muted">
                  {day.dateLabel}
                </span>
                {!day.working ? (
                  <Chip tone="lock" className="ml-auto">
                    Not a working day
                  </Chip>
                ) : null}
              </div>
              <Card>
                <ul>
                  {day.rows.map((row) => (
                    <TaskRow key={`${row.taskId}:${row.date}`} row={row} />
                  ))}
                </ul>
              </Card>
            </section>
          ))
        )
      ) : missed === 0 ? (
        <Card>
          <Empty
            title="Nothing missed"
            hint={`Everything due in ${data.missedWindowLabel} was ticked off.`}
          />
        </Card>
      ) : (
        <>
          <p className="px-1 text-[13px] leading-snug text-ink-2">
            These were due and never ticked. Tick one off here if you have done
            it since.
          </p>
          {data.missedDays.map((day) => (
            <section key={day.date} className="flex flex-col gap-2">
              <div className="flex items-center gap-2 px-1">
                <h2 className="label">{day.heading}</h2>
                <span className="font-mono text-xs text-muted">{day.ago}</span>
              </div>
              <Card>
                <ul>
                  {day.rows.map((row) => (
                    <TaskRow key={`${row.taskId}:${row.date}`} row={row} />
                  ))}
                </ul>
              </Card>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
