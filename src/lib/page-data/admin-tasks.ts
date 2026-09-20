import "server-only";

import { and, asc, eq, isNull, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { tasks, type Task, type User } from "@/db/schema";
import { householdMembers, type Viewer } from "@/lib/auth";
import { formatDate, formatTime } from "@/lib/dates";
import { describeRule } from "@/lib/tasks";

/* The admin task list, filtered by assignee and live/archived, as JSON. */

export type AdminTaskRow = {
  id: number;
  title: string;
  assignee: { label: string; name: string; role: "admin" | "employee" } | null;
  archived: boolean;
  /** "17:30", or null when the task has no time of day. */
  time: string | null;
  /** The rule in words, or the due date for a once-off. */
  when: string;
};

export type AdminTasksData = {
  currentUserId: number;
  showArchived: boolean;
  whoId: number | null;
  members: { id: number; label: string }[];
  total: number;
  recurring: AdminTaskRow[];
  once: AdminTaskRow[];
};

type TaskWithAssignee = Task & { assignee: User | null };

export async function loadAdminTasks(
  viewer: Viewer,
  query: URLSearchParams,
): Promise<AdminTasksData> {
  const { household, user } = viewer;
  const showArchived = query.get("show") === "archived";
  const who = query.get("who");
  const whoId = who && Number.isFinite(Number(who)) ? Number(who) : null;

  // The member list and the tasks do not depend on each other.
  const [members, rows] = await Promise.all([
    householdMembers(household.id),
    db.query.tasks.findMany({
      where: and(
        eq(tasks.householdId, household.id),
        showArchived ? isNotNull(tasks.archivedAt) : isNull(tasks.archivedAt),
        whoId ? eq(tasks.assignedTo, whoId) : undefined,
      ),
      with: { assignee: true },
      orderBy: [asc(tasks.title)],
    }) as Promise<TaskWithAssignee[]>,
  ]);

  const toRow = (task: TaskWithAssignee): AdminTaskRow => ({
    id: task.id,
    title: task.title,
    assignee: task.assignee
      ? {
          label: task.assignee.id === user.id ? "You" : task.assignee.name,
          name: task.assignee.name,
          role: task.assignee.role,
        }
      : null,
    archived: task.archivedAt !== null,
    time: task.timeOfDay ? formatTime(task.timeOfDay) : null,
    when:
      task.kind === "once" && task.dueDate
        ? formatDate(task.dueDate)
        : describeRule(task),
  });

  return {
    currentUserId: user.id,
    showArchived,
    whoId,
    members: members.map((person) => ({
      id: person.id,
      label: person.id === user.id ? "Me" : person.name,
    })),
    total: rows.length,
    recurring: rows.filter((t) => t.kind === "recurring").map(toRow),
    once: rows.filter((t) => t.kind === "once").map(toRow),
  };
}
