import "server-only";

import { and, asc, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { db } from "@/db";
import {
  taskCompletions,
  taskSkips,
  tasks,
  users,
  type Task,
  type User,
} from "@/db/schema";
import {
  daysBetween,
  isoWeekday,
  shiftDate,
  startOfIsoWeek,
  WEEKDAY_NAMES,
  type IsoDate,
} from "@/lib/dates";
import type { CalendarSet, WorkdayCalendar } from "@/lib/workdays";

export type TaskOccurrence = {
  task: Task;
  assignee: User | null;
  date: IsoDate;
  done: boolean;
  completedAt: Date | null;
  completedBy: number | null;
  /** A once-off task whose due date has passed and was never ticked. */
  overdue: boolean;
};

/* --------------------------------------------------------- the rule itself -- */

/**
 * Whether a task occurs on a given date. Occurrences are never written to the
 * database: they are derived from the rule whenever a range is displayed, so
 * editing a rule changes the future without rewriting the past.
 */
export function occursOn(
  task: Task,
  date: IsoDate,
  calendar: WorkdayCalendar,
): boolean {
  if (task.archivedAt) return false;

  if (task.kind === "once") return task.dueDate === date;

  const start = task.startDate;
  if (!start || date < start) return false;
  if (task.endDate && date > task.endDate) return false;
  if (task.workingDaysOnly && !calendar.isWorking(date)) return false;

  const every = Math.max(1, task.interval);

  switch (task.frequency) {
    case "daily":
      return daysBetween(start, date) % every === 0;

    case "weekly": {
      const weekdays = task.weekdays ?? [];
      if (!weekdays.includes(isoWeekday(date))) return false;
      const weeks = Math.round(
        daysBetween(startOfIsoWeek(start), startOfIsoWeek(date)) / 7,
      );
      return weeks % every === 0;
    }

    case "monthly": {
      const [year, month, day] = date.split("-").map(Number);
      const [startYear, startMonth] = start.split("-").map(Number);
      const months = (year - startYear) * 12 + (month - startMonth);
      if (months < 0 || months % every !== 0) return false;

      if (task.monthlyMode === "weekday_of_month") {
        return isNthWeekday(
          date,
          task.monthWeek ?? 1,
          task.monthWeekday ?? isoWeekday(start),
        );
      }

      const target = task.monthDay ?? Number(start.split("-")[2]);
      // A 31st rule still fires on the 30th of a 30-day month.
      return day === Math.min(target, daysInMonth(year, month));
    }

    default:
      return false;
  }
}

/** How many days a month has. `day 0` of the next month is this month's last. */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Whether a date is, say, the last Thursday of its month. `nth` counts from the
 * start of the month, except -1, which means the last one — that is the whole
 * point of the mode, since "the last Thursday" is the 4th in some months and
 * the 5th in others.
 */
export function isNthWeekday(
  date: IsoDate,
  nth: number,
  weekday: number,
): boolean {
  if (isoWeekday(date) !== weekday) return false;
  const [year, month, day] = date.split("-").map(Number);
  if (nth === -1) return day + 7 > daysInMonth(year, month);
  return Math.floor((day - 1) / 7) + 1 === nth;
}

/** "the last", "the second" — how a week of the month reads in a sentence. */
export function weekOfMonthName(nth: number): string {
  if (nth === -1) return "the last";
  return ["the first", "the second", "the third", "the fourth"][nth - 1] ?? "the first";
}

/** A human sentence for a task's rule, e.g. "Mon, Wed and Fri". */
export function describeRule(task: Task): string {
  if (task.kind === "once") return "Once-off";

  const every = Math.max(1, task.interval);
  const names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  switch (task.frequency) {
    case "daily": {
      const base =
        every === 1 ? "Every day" : `Every ${every} days`;
      return task.workingDaysOnly ? "Every working day" : base;
    }
    case "weekly": {
      const days = (task.weekdays ?? [])
        .slice()
        .sort((a, b) => a - b)
        .map((d) => names[d - 1]);
      const list =
        days.length === 0
          ? "Weekly"
          : days.length === 1
            ? days[0]
            : `${days.slice(0, -1).join(", ")} and ${days[days.length - 1]}`;
      return every === 1 ? list : `${list}, every ${every} weeks`;
    }
    case "monthly": {
      const which =
        task.monthlyMode === "weekday_of_month"
          ? `${weekOfMonthName(task.monthWeek ?? 1)} ${
              WEEKDAY_NAMES[(task.monthWeekday ?? 1) - 1]
            }`
          : `the ${ordinal(task.monthDay ?? 1)}`;
      return every === 1
        ? `Monthly on ${which}`
        : `Every ${every} months on ${which}`;
    }
    default:
      return "Recurring";
  }
}

export function ordinal(n: number): string {
  const suffix =
    n % 100 >= 11 && n % 100 <= 13
      ? "th"
      : n % 10 === 1
        ? "st"
        : n % 10 === 2
          ? "nd"
          : n % 10 === 3
            ? "rd"
            : "th";
  return `${n}${suffix}`;
}

/** The next few dates a rule will fire on, for the editor's preview. */
export function nextOccurrences(
  task: Task,
  from: IsoDate,
  calendar: WorkdayCalendar,
  limit = 5,
): IsoDate[] {
  const out: IsoDate[] = [];
  let cursor = from;
  // Three years: a rule that only fires every few months still fills a preview.
  for (let i = 0; i < 1100 && out.length < limit; i++) {
    if (occursOn(task, cursor, calendar)) out.push(cursor);
    const [y, m, d] = cursor.split("-").map(Number);
    const next = new Date(Date.UTC(y, m - 1, d + 1));
    cursor = next.toISOString().slice(0, 10);
  }
  return out;
}

/* ------------------------------------------------------------- the queries -- */

type LoadOptions = {
  householdId: number;
  from: IsoDate;
  to: IsoDate;
  /**
   * Everyone's calendars. A task is expanded against its own assignee's days,
   * so one person's sick day never removes another person's tasks.
   */
  calendars: CalendarSet;
  /** Only this person's tasks. Omit for everyone's. */
  assigneeId?: number;
  /** Include once-off tasks whose due date is before `from` and not ticked. */
  includeOverdue?: boolean;
};

/**
 * Expands every live task over a date range and pairs each occurrence with its
 * completion, if it has one.
 */
export async function loadOccurrences({
  householdId,
  from,
  to,
  calendars,
  assigneeId,
  includeOverdue = false,
}: LoadOptions): Promise<TaskOccurrence[]> {
  const rows = await db.query.tasks.findMany({
    where: and(
      eq(tasks.householdId, householdId),
      isNull(tasks.archivedAt),
      assigneeId ? eq(tasks.assignedTo, assigneeId) : undefined,
    ),
    with: { assignee: true },
    orderBy: [asc(tasks.timeOfDay), asc(tasks.id)],
  });
  if (rows.length === 0) return [];

  const ids = rows.map((t) => t.id);
  const historyFrom = includeOverdue ? "1900-01-01" : from;

  const [completions, skips] = await Promise.all([
    db.query.taskCompletions.findMany({
      where: and(
        inArray(taskCompletions.taskId, ids),
        gte(taskCompletions.occurrenceDate, historyFrom),
        lte(taskCompletions.occurrenceDate, to),
      ),
    }),
    db.query.taskSkips.findMany({
      where: and(
        inArray(taskSkips.taskId, ids),
        gte(taskSkips.occurrenceDate, historyFrom),
        lte(taskSkips.occurrenceDate, to),
      ),
    }),
  ]);

  const completionKey = (taskId: number, date: IsoDate) => `${taskId}:${date}`;
  const doneMap = new Map(
    completions.map((c) => [completionKey(c.taskId, c.occurrenceDate), c]),
  );
  const skipSet = new Set(
    skips.map((s) => completionKey(s.taskId, s.occurrenceDate)),
  );

  const out: TaskOccurrence[] = [];

  for (const task of rows) {
    const assignee = (task as typeof task & { assignee: User | null }).assignee;
    const calendar = calendars.for(task.assignedTo);

    // Overdue once-off tasks surface on today's list until they are ticked.
    if (
      includeOverdue &&
      task.kind === "once" &&
      task.dueDate &&
      task.dueDate < from &&
      !doneMap.has(completionKey(task.id, task.dueDate)) &&
      !skipSet.has(completionKey(task.id, task.dueDate))
    ) {
      out.push({
        task,
        assignee,
        date: task.dueDate,
        done: false,
        completedAt: null,
        completedBy: null,
        overdue: true,
      });
    }

    for (let date = from; date <= to; date = nextDay(date)) {
      if (!occursOn(task, date, calendar)) continue;
      const key = completionKey(task.id, date);
      if (skipSet.has(key)) continue;
      const completion = doneMap.get(key);
      out.push({
        task,
        assignee,
        date,
        done: Boolean(completion),
        completedAt: completion?.completedAt ?? null,
        completedBy: completion?.completedBy ?? null,
        overdue: false,
      });
    }
  }

  return out.sort(byTimeThenTitle);
}

/**
 * What was due before today and never ticked, newest first. A missed
 * occurrence stays here until someone ticks it or an admin skips it, so work
 * that slipped is caught rather than quietly lost. Today is deliberately left
 * out: it is still outstanding, not yet missed.
 */
export async function loadMissed({
  householdId,
  calendars,
  today,
  since,
  assigneeId,
}: {
  householdId: number;
  calendars: CalendarSet;
  today: IsoDate;
  /** The oldest date to look back to, inclusive. */
  since: IsoDate;
  assigneeId?: number;
}): Promise<TaskOccurrence[]> {
  if (since >= today) return [];

  const occurrences = await loadOccurrences({
    householdId,
    from: since,
    to: shiftDate(today, -1),
    calendars,
    assigneeId,
  });

  return occurrences
    .filter((o) => !o.done)
    .sort((a, b) =>
      a.date === b.date ? byTimeThenTitle(a, b) : a.date < b.date ? 1 : -1,
    );
}

function byTimeThenTitle(a: TaskOccurrence, b: TaskOccurrence): number {
  if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  const at = a.task.timeOfDay ?? "99:99";
  const bt = b.task.timeOfDay ?? "99:99";
  if (at !== bt) return at < bt ? -1 : 1;
  return a.task.title.localeCompare(b.task.title);
}

function nextDay(date: IsoDate): IsoDate {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/** Ticks or unticks one occurrence. */
export async function setTaskDone(
  taskId: number,
  date: IsoDate,
  done: boolean,
  userId: number,
): Promise<void> {
  if (done) {
    await db
      .insert(taskCompletions)
      .values({ taskId, occurrenceDate: date, completedBy: userId })
      .onConflictDoNothing({
        target: [taskCompletions.taskId, taskCompletions.occurrenceDate],
      });
    return;
  }

  await db
    .delete(taskCompletions)
    .where(
      and(
        eq(taskCompletions.taskId, taskId),
        eq(taskCompletions.occurrenceDate, date),
      ),
    );
}

/** Recent completions for one task, newest first. */
export async function taskHistory(taskId: number, limit = 10) {
  const rows = await db.query.taskCompletions.findMany({
    where: eq(taskCompletions.taskId, taskId),
    with: { completedByUser: true },
    orderBy: [asc(taskCompletions.occurrenceDate)],
  });
  return rows.slice(-limit).reverse();
}

export async function loadTask(taskId: number, householdId: number) {
  return db.query.tasks.findFirst({
    where: and(eq(tasks.id, taskId), eq(tasks.householdId, householdId)),
    with: { assignee: true },
  });
}

export async function loadAssignableUsers(householdId: number) {
  return db.query.users.findMany({ where: eq(users.householdId, householdId) });
}
