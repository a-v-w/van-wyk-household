"use client";

import { PageError, PageSkeleton } from "@/components/skeleton";
import { TaskRow } from "@/components/task-list";
import { Card, Chip, Empty } from "@/components/ui";
import { useClientData } from "@/lib/client-data";
import type { TasksData } from "@/lib/page-data/tasks";

export function TasksPage() {
  const { data, error, refresh } = useClientData<TasksData>("/api/tasks");

  if (error && !data) return <PageError message={error} onRetry={refresh} />;
  if (!data) return <PageSkeleton variant="employee" cards={3} />;

  return (
    <div className="flex flex-col gap-5 px-4 pt-2 pb-8">
      <header className="flex flex-col gap-1 px-1">
        <p className="font-mono text-xs tracking-widest text-muted uppercase">
          Next two weeks
        </p>
        <h1 className="text-[28px] leading-tight font-extrabold tracking-tight">
          Your tasks
        </h1>
      </header>

      {data.total === 0 ? (
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
      )}
    </div>
  );
}
