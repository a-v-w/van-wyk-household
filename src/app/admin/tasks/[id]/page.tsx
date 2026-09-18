import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TaskEditor } from "@/components/task-editor";
import { Card, CardHeader, Chip, IconChevronLeft } from "@/components/ui";
import { householdMembers, requireAdmin } from "@/lib/auth";
import { formatDayDate, shiftDate, todayIn } from "@/lib/dates";
import { loadTask, nextOccurrences, taskHistory } from "@/lib/tasks";
import { loadWorkdayCalendar } from "@/lib/workdays";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Edit task" };

export default async function EditTaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requireAdmin();
  const { id } = await params;
  const taskId = Number(id);
  if (!Number.isFinite(taskId)) notFound();

  const task = await loadTask(taskId, viewer.household.id);
  if (!task) notFound();

  const members = await householdMembers(viewer.household.id);
  const today = todayIn(viewer.household.timezone);
  const calendar = await loadWorkdayCalendar(
    viewer.household,
    today,
    shiftDate(today, 120),
  );

  const preview = nextOccurrences(task, today, calendar, 5).map(formatDayDate);
  const history = await taskHistory(task.id, 8);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-5 py-6 lg:px-8 lg:py-8">
      <Link
        href="/admin/tasks"
        className="flex items-center gap-1 text-sm font-bold text-accent"
      >
        <IconChevronLeft size={16} />
        All tasks
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl leading-tight font-extrabold tracking-tight">
          Edit task
        </h1>
        {task.archivedAt ? <Chip tone="danger">Archived</Chip> : null}
      </div>

      <Card className="p-5 lg:p-6">
        <TaskEditor
          currentUserId={viewer.user.id}
          people={members.map((m) => ({
            id: m.id,
            name: m.name,
            role: m.role,
          }))}
          previewDates={preview}
          values={{
            id: task.id,
            title: task.title,
            notes: task.notes ?? "",
            kind: task.kind,
            assignedTo: task.assignedTo,
            timeOfDay: task.timeOfDay?.slice(0, 5) ?? "",
            workingDaysOnly: task.workingDaysOnly,
            frequency: task.frequency ?? "weekly",
            interval: task.interval,
            weekdays: task.weekdays ?? [],
            monthDay: task.monthDay ?? 1,
            dueDate: task.dueDate ?? today,
            startDate: task.startDate ?? today,
            endDate: task.endDate ?? "",
          }}
        />
      </Card>

      <Card>
        <CardHeader title="Recent history" />
        {history.length === 0 ? (
          <p className="px-5 pt-1 pb-5 text-sm text-muted">
            Nothing ticked off yet.
          </p>
        ) : (
          <ul className="px-5 pt-1 pb-5">
            {history.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-3 border-b border-line py-2 text-sm last:border-b-0"
              >
                <span>{formatDayDate(entry.occurrenceDate)}</span>
                <span className="font-mono text-xs text-ok">
                  Done{" "}
                  {entry.completedAt.toLocaleTimeString("en-ZA", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                    timeZone: viewer.household.timezone,
                  })}
                  {entry.completedByUser
                    ? ` · ${entry.completedByUser.name.split(/\s+/)[0]}`
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
