import { and, asc, eq, isNull, isNotNull } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/db";
import { tasks, type Task, type User } from "@/db/schema";
import {
  Avatar,
  Card,
  Chip,
  Empty,
  IconPlus,
  buttonClass,
  cn,
} from "@/components/ui";
import { householdMembers, requireAdmin } from "@/lib/auth";
import { formatDate, formatTime } from "@/lib/dates";
import { describeRule } from "@/lib/tasks";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Tasks" };

type TaskWithAssignee = Task & { assignee: User | null };

export default async function AdminTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ who?: string; show?: string }>;
}) {
  const viewer = await requireAdmin();
  const params = await searchParams;
  const members = await householdMembers(viewer.household.id);

  const showArchived = params.show === "archived";
  const whoId = params.who ? Number(params.who) : null;

  const rows = (await db.query.tasks.findMany({
    where: and(
      eq(tasks.householdId, viewer.household.id),
      showArchived ? isNotNull(tasks.archivedAt) : isNull(tasks.archivedAt),
      whoId ? eq(tasks.assignedTo, whoId) : undefined,
    ),
    with: { assignee: true },
    orderBy: [asc(tasks.title)],
  })) as TaskWithAssignee[];

  const recurring = rows.filter((t) => t.kind === "recurring");
  const once = rows.filter((t) => t.kind === "once");

  function filterHref(who: number | null) {
    const query = new URLSearchParams();
    if (who) query.set("who", String(who));
    if (showArchived) query.set("show", "archived");
    const qs = query.toString();
    return qs ? `/admin/tasks?${qs}` : "/admin/tasks";
  }

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
          href={filterHref(null)}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-bold transition-colors",
            !whoId
              ? "border-accent bg-accent-soft text-accent"
              : "border-line bg-surface text-ink-2 hover:bg-surface-2",
          )}
        >
          Everyone
        </Link>
        {members.map((person) => (
          <Link
            key={person.id}
            href={filterHref(person.id)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-bold transition-colors",
              whoId === person.id
                ? "border-accent bg-accent-soft text-accent"
                : "border-line bg-surface text-ink-2 hover:bg-surface-2",
            )}
          >
            {person.id === viewer.user.id ? "Me" : person.name}
          </Link>
        ))}

        <Link
          href={
            showArchived
              ? filterHref(whoId).replace(/[?&]show=archived/, "")
              : `${filterHref(whoId)}${filterHref(whoId).includes("?") ? "&" : "?"}show=archived`
          }
          className="ml-auto text-xs font-bold text-accent"
        >
          {showArchived ? "Show live tasks" : "Show archived"}
        </Link>
      </div>

      {rows.length === 0 ? (
        <Card>
          <Empty
            title={showArchived ? "Nothing archived" : "No tasks yet"}
            hint={
              showArchived
                ? undefined
                : "Add the things that happen every day first, then the one-offs."
            }
          />
        </Card>
      ) : (
        <>
          <TaskGroup
            title="Recurring"
            rows={recurring}
            currentUserId={viewer.user.id}
          />
          <TaskGroup
            title="Once-off"
            rows={once}
            currentUserId={viewer.user.id}
          />
        </>
      )}
    </div>
  );
}

function TaskGroup({
  title,
  rows,
  currentUserId,
}: {
  title: string;
  rows: TaskWithAssignee[];
  currentUserId: number;
}) {
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
                      {task.assignee.id === currentUserId
                        ? "You"
                        : task.assignee.name}
                    </span>
                  ) : null}
                </div>
                {task.archivedAt ? <Chip tone="danger">Archived</Chip> : null}
                {task.timeOfDay ? (
                  <Chip className="font-mono tabular">
                    {formatTime(task.timeOfDay)}
                  </Chip>
                ) : null}
                <Chip>
                  {task.kind === "once" && task.dueDate
                    ? formatDate(task.dueDate)
                    : describeRule(task)}
                </Chip>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}
