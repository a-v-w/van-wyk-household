"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  taskSkips,
  tasks,
  users,
  type MonthlyMode,
  type TaskFrequency,
} from "@/db/schema";
import { requireAdmin, requireViewer } from "@/lib/auth";
import { setTaskDone } from "@/lib/tasks";

export type TaskFormState = { error?: string; ok?: boolean } | undefined;

function refresh() {
  revalidatePath("/today");
  revalidatePath("/tasks");
  revalidatePath("/admin");
  revalidatePath("/admin/tasks");
  revalidatePath("/admin/missed");
}

/* ------------------------------------------------------------- ticking off -- */

export async function toggleTask(
  taskId: number,
  date: string,
  done: boolean,
): Promise<void> {
  const viewer = await requireViewer();

  const task = await db.query.tasks.findFirst({
    where: and(eq(tasks.id, taskId), eq(tasks.householdId, viewer.household.id)),
  });
  if (!task) return;

  // The admin can tick anything; everyone else only their own.
  if (!viewer.isAdmin && task.assignedTo !== viewer.user.id) return;

  await setTaskDone(taskId, date, done, viewer.user.id);
  refresh();
}

/** Cancels a single occurrence without touching the rule. */
export async function skipOccurrence(
  taskId: number,
  date: string,
): Promise<void> {
  const viewer = await requireAdmin();

  const task = await db.query.tasks.findFirst({
    where: and(eq(tasks.id, taskId), eq(tasks.householdId, viewer.household.id)),
  });
  if (!task) return;

  await db
    .insert(taskSkips)
    .values({ taskId, occurrenceDate: date })
    .onConflictDoNothing({
      target: [taskSkips.taskId, taskSkips.occurrenceDate],
    });
  refresh();
}

/* ----------------------------------------------------------- create / edit -- */

function parseWeekdays(formData: FormData): number[] {
  return formData
    .getAll("weekdays")
    .map((value) => Number(value))
    .filter((n) => n >= 1 && n <= 7);
}

function parseTaskInput(formData: FormData, householdId: number) {
  const title = String(formData.get("title") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const kind = formData.get("kind") === "recurring" ? "recurring" : "once";
  const assignedTo = Number(formData.get("assignedTo"));
  const timeOfDay = String(formData.get("timeOfDay") ?? "").trim() || null;
  const workingDaysOnly = formData.get("workingDaysOnly") === "on";

  const frequency = (String(formData.get("frequency") ?? "weekly") ||
    "weekly") as TaskFrequency;
  const interval = Math.max(1, Number(formData.get("interval") ?? 1) || 1);
  const weekdays = parseWeekdays(formData);
  const monthDay = Math.min(
    31,
    Math.max(1, Number(formData.get("monthDay") ?? 1) || 1),
  );

  // A monthly rule picks its day one of two ways: "the 5th", or "the last
  // Thursday". Only the fields belonging to the chosen one are kept.
  const byWeekday = formData.get("monthlyMode") === "weekday_of_month";
  const weekChoice = Number(formData.get("monthWeek") ?? 1);
  const monthWeek = [1, 2, 3, 4, -1].includes(weekChoice) ? weekChoice : 1;
  const monthWeekday = Math.min(
    7,
    Math.max(1, Number(formData.get("monthWeekday") ?? 1) || 1),
  );
  const monthly = kind === "recurring" && frequency === "monthly";

  const dueDate = String(formData.get("dueDate") ?? "").trim() || null;
  const startDate = String(formData.get("startDate") ?? "").trim() || null;
  const endDate = String(formData.get("endDate") ?? "").trim() || null;

  return {
    householdId,
    title,
    notes,
    kind,
    assignedTo,
    timeOfDay,
    workingDaysOnly,
    dueDate: kind === "once" ? dueDate : null,
    frequency: kind === "recurring" ? frequency : null,
    interval,
    weekdays: kind === "recurring" && frequency === "weekly" ? weekdays : null,
    monthlyMode: (monthly && byWeekday
      ? "weekday_of_month"
      : "day_of_month") as MonthlyMode,
    monthDay: monthly && !byWeekday ? monthDay : null,
    monthWeek: monthly && byWeekday ? monthWeek : null,
    monthWeekday: monthly && byWeekday ? monthWeekday : null,
    startDate: kind === "recurring" ? startDate : null,
    endDate: kind === "recurring" ? endDate : null,
  } as const;
}

function validate(input: ReturnType<typeof parseTaskInput>): string | null {
  if (!input.title) return "Give the task a title.";
  if (!input.assignedTo) return "Choose who the task is for.";
  if (input.kind === "once" && !input.dueDate) return "Pick a date for it.";
  if (input.kind === "recurring") {
    if (!input.startDate) return "Pick the date the task starts on.";
    if (input.frequency === "weekly" && (input.weekdays?.length ?? 0) === 0) {
      return "Pick at least one day of the week.";
    }
    if (input.endDate && input.endDate < input.startDate) {
      return "The end date is before the start date.";
    }
  }
  return null;
}

export async function saveTask(
  _state: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const viewer = await requireAdmin();
  const id = Number(formData.get("id") ?? 0);
  const input = parseTaskInput(formData, viewer.household.id);

  const problem = validate(input);
  if (problem) return { error: problem };

  // The assignee has to be someone in this household.
  const assignee = await db.query.users.findFirst({
    where: and(
      eq(users.id, input.assignedTo),
      eq(users.householdId, viewer.household.id),
    ),
  });
  if (!assignee) return { error: "That person is not in this household." };

  if (id) {
    await db
      .update(tasks)
      .set({ ...input })
      .where(
        and(eq(tasks.id, id), eq(tasks.householdId, viewer.household.id)),
      );
  } else {
    await db.insert(tasks).values({ ...input, createdBy: viewer.user.id });
  }

  refresh();
  return { ok: true };
}

export async function archiveTask(taskId: number): Promise<void> {
  const viewer = await requireAdmin();
  await db
    .update(tasks)
    .set({ archivedAt: new Date() })
    .where(
      and(eq(tasks.id, taskId), eq(tasks.householdId, viewer.household.id)),
    );
  refresh();
}

export async function restoreTask(taskId: number): Promise<void> {
  const viewer = await requireAdmin();
  await db
    .update(tasks)
    .set({ archivedAt: null })
    .where(
      and(eq(tasks.id, taskId), eq(tasks.householdId, viewer.household.id)),
    );
  refresh();
}
