"use client";

import Link from "next/link";
import { PageError, PageSkeleton } from "@/components/skeleton";
import { TaskEditor } from "@/components/task-editor";
import {
  Card,
  CardHeader,
  Chip,
  Empty,
  IconChevronLeft,
} from "@/components/ui";
import { useClientData } from "@/lib/client-data";
import type { AdminTaskDetailData } from "@/lib/page-data/admin-task-detail";

export function TaskDetailPage({ id }: { id: string }) {
  const { data, error, refresh } = useClientData<AdminTaskDetailData>(
    `/api/admin/tasks/detail?id=${encodeURIComponent(id)}`,
  );

  if (error && !data) return <PageError message={error} onRetry={refresh} />;
  if (!data) return <PageSkeleton variant="admin" cards={2} />;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-5 py-6 lg:px-8 lg:py-8">
      <Link
        href="/admin/tasks"
        className="flex items-center gap-1 text-sm font-bold text-accent"
      >
        <IconChevronLeft size={16} />
        All tasks
      </Link>

      {!data.found ? (
        <Card>
          <Empty
            title="That task is not here"
            hint="It may have been removed, or the link is wrong."
          />
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl leading-tight font-extrabold tracking-tight">
              Edit task
            </h1>
            {data.archived ? <Chip tone="danger">Archived</Chip> : null}
          </div>

          <Card className="p-5 lg:p-6">
            <TaskEditor
              key={data.values.id}
              currentUserId={data.currentUserId}
              people={data.people}
              previewDates={data.previewDates}
              values={data.values}
            />
          </Card>

          <Card>
            <CardHeader title="Recent history" />
            {data.history.length === 0 ? (
              <p className="px-5 pt-1 pb-5 text-sm text-muted">
                Nothing ticked off yet.
              </p>
            ) : (
              <ul className="px-5 pt-1 pb-5">
                {data.history.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-center justify-between gap-3 border-b border-line py-2 text-sm last:border-b-0"
                  >
                    <span>{entry.date}</span>
                    <span className="font-mono text-xs text-ok">
                      {entry.label}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
