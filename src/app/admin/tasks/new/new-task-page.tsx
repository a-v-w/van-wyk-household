"use client";

import Link from "next/link";
import { PageError, PageSkeleton } from "@/components/skeleton";
import { TaskEditor } from "@/components/task-editor";
import { Card, IconChevronLeft } from "@/components/ui";
import { useClientData } from "@/lib/client-data";
import type { AdminTaskNewData } from "@/lib/page-data/admin-task-new";

export function NewTaskPage() {
  const { data, error, refresh } = useClientData<AdminTaskNewData>(
    "/api/admin/tasks/new",
  );

  if (error && !data) return <PageError message={error} onRetry={refresh} />;
  if (!data) return <PageSkeleton variant="admin" cards={1} />;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-5 py-6 lg:px-8 lg:py-8">
      <Link
        href="/admin/tasks"
        className="flex items-center gap-1 text-sm font-bold text-accent"
      >
        <IconChevronLeft size={16} />
        All tasks
      </Link>

      <h1 className="text-3xl leading-tight font-extrabold tracking-tight">
        New task
      </h1>

      <Card className="p-5 lg:p-6">
        <TaskEditor
          currentUserId={data.currentUserId}
          people={data.people}
          previewDates={[]}
          values={data.values}
        />
      </Card>
    </div>
  );
}
