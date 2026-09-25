import "server-only";

import type { EditorPerson, TaskEditorValues } from "@/components/task-editor";
import { householdMembers, type Viewer } from "@/lib/auth";
import { formatDayDate, isoWeekday, shiftDate, todayIn } from "@/lib/dates";
import { loadTask, nextOccurrences, taskHistory } from "@/lib/tasks";
import { loadWorkdayCalendar } from "@/lib/workdays";

/* One task, ready for the editor, with its preview and recent history. */

export type AdminTaskDetailData =
  | { found: false }
  | {
      found: true;
      currentUserId: number;
      archived: boolean;
      people: EditorPerson[];
      previewDates: string[];
      values: TaskEditorValues;
      history: { id: number; date: string; label: string }[];
    };

export async function loadAdminTaskDetail(
  viewer: Viewer,
  query: URLSearchParams,
): Promise<AdminTaskDetailData> {
  const { household, user } = viewer;
  const taskId = Number(query.get("id"));
  if (!Number.isFinite(taskId)) return { found: false };

  // The task and the member list do not depend on each other.
  const [task, members] = await Promise.all([
    loadTask(taskId, household.id),
    householdMembers(household.id),
  ]);
  if (!task) return { found: false };

  const today = todayIn(household.timezone);
  const [calendar, history] = await Promise.all([
    loadWorkdayCalendar(household, task.assignedTo, today, shiftDate(today, 120)),
    taskHistory(task.id, 8),
  ]);

  return {
    found: true,
    currentUserId: user.id,
    archived: task.archivedAt !== null,
    people: members.map((m) => ({ id: m.id, name: m.name, role: m.role })),
    previewDates: nextOccurrences(task, today, calendar, 5).map(formatDayDate),
    values: {
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
      monthlyMode: task.monthlyMode,
      monthWeek: task.monthWeek ?? 1,
      monthWeekday: task.monthWeekday ?? isoWeekday(task.startDate ?? today),
      dueDate: task.dueDate ?? today,
      startDate: task.startDate ?? today,
      endDate: task.endDate ?? "",
    },
    history: history.map((entry) => ({
      id: entry.id,
      date: formatDayDate(entry.occurrenceDate),
      label: `Done ${entry.completedAt.toLocaleTimeString("en-ZA", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: household.timezone,
      })}${
        entry.completedByUser
          ? ` · ${entry.completedByUser.name.split(/\s+/)[0]}`
          : ""
      }`,
    })),
  };
}
