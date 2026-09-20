"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageError, PageSkeleton } from "@/components/skeleton";
import {
  Avatar,
  Card,
  Chip,
  Empty,
  IconPlus,
  buttonClass,
  cn,
} from "@/components/ui";
import { useClientData } from "@/lib/client-data";
import type {
  AdminTaskRow,
  AdminTasksData,
} from "@/lib/page-data/admin-tasks";

function filterHref(who: number | null, archived: boolean): string {
  const query = new URLSearchParams();
  if (who) query.set("who", String(who));
  if (archived) query.set("show", "archived");
  const qs = query.toString();
  return qs ? `/admin/tasks?${qs}` : "/admin/tasks";
}

export function AdminTasksPage() {
  const searchParams = useSearchParams();
  const showArchived = searchParams.get("show") === "archived";
  const who = searchParams.get("who");
  const whoId = who ? Number(who) : null;

  const { data, error, refresh } = useClientData<AdminTasksData>(
    filterHref(whoId, showArchived).replace("/admin/tasks", "/api/admin/tasks"),
  );

  if (error && !data) return <PageError message={error} onRetry={refresh} />;
  if (!data) return <PageSkeleton variant="admin" cards={2} />;

  return (
    <div className="flex flex-col gap-5 px-5 py-6 lg:px-8 lg:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl leading-tight font-extrabold tracking-tight">
          Tasks
        </h1>
        <Link href="/admin/tasks/new" className={buttonClass("primary")}>
          <IconPlus size={16} />
          New task
        </Link>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <span className="label mr-1">Assignee</span>
        <Link
          href={filterHref(null, showArchived)}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-bold transition-colors",
            !whoId
              ? "border-accent bg-accent-soft text-accent"
              : "border-line bg-surface text-ink-2 hover:bg-surface-2",
          )}
        >
          Everyone
        </Link>
        {data.members.map((person) => (
          <Link
            key={person.id}
            href={filterHref(person.id, showArchived)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-bold transition-colors",
              whoId === person.id
                ? "border-accent bg-accent-soft text-accent"
                : "border-line bg-surface text-ink-2 hover:bg-surface-2",
            )}
          >
            {person.label}
          </Link>
        ))}

        <Link
          href={filterHref(whoId, !showArchived)}
          className="ml-auto text-xs font-bold text-accent"
        >
          {showArchived ? "Show live tasks" : "Show archived"}
        </Link>
      </div>

      {data.total === 0 ? (
        <Card>
          <Empty
            title={data.showArchived ? "Nothing archived" : "No tasks yet"}
            hint={
              data.showArchived
                ? undefined
                : "Add the things that happen every day first, then the one-offs."
            }
          />
        </Card>
      ) : (
        <>
          <TaskGroup title="Recurring" rows={data.recurring} />
          <TaskGroup title="Once-off" rows={data.once} />
        </>
      )}
    </div>
  );
}

function TaskGroup({ title, rows }: { title: string; rows: AdminTaskRow[] }) {
  if (rows.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="label">{title}</h2>
      <Card>
        <ul>
          {rows.map((task) => (
            <li key={task.id} className="border-b border-line last:border-b-0">
              <Link
                href={`/admin/tasks/${task.id}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2"
              >
                {task.assignee ? (
                  <Avatar
                    name={task.assignee.name}
                    role={task.assignee.role}
                    size="sm"
                  />
                ) : null}
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-sm font-bold">
                    {task.title}
                  </span>
                  {task.assignee ? (
                    <span className="text-xs text-muted">
                      {task.assignee.label}
                    </span>
                  ) : null}
                </div>
                {task.archived ? <Chip tone="danger">Archived</Chip> : null}
                {task.time ? (
                  <Chip className="font-mono tabular">{task.time}</Chip>
                ) : null}
                <Chip>{task.when}</Chip>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}
