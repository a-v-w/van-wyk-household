import "server-only";

import type { TaskRowData } from "@/components/task-list";
import type { Viewer } from "@/lib/auth";
import {
  daysBetween,
  formatDayDate,
  formatTime,
  isoWeek,
  relativeDay,
  shiftDate,
  todayIn,
  type IsoDate,
} from "@/lib/dates";
import { describeRule, loadMissed, loadOccurrences } from "@/lib/tasks";
import { loadCalendars } from "@/lib/workdays";

/* The signed-in person's tasks: the next two weeks, and what they missed. */

/** How far back the catch-up list looks. */
export const MISSED_WINDOW_DAYS = 14;

export type TasksDay = {
  date: IsoDate;
  /** "Today", "Tomorrow" or the short date. */
  heading: string;
  dateLabel: string;
  working: boolean;
  rows: TaskRowData[];
};

export type MissedDay = {
  date: IsoDate;
  /** "Yesterday" or the short date. */
  heading: string;
  /** "3 days ago". */
  ago: string;
  rows: TaskRowData[];
};

export type TasksData = {
  today: IsoDate;
  total: number;
  days: TasksDay[];
  /** Everything due before today and never ticked, newest first. */
  missedTotal: number;
  missedDays: MissedDay[];
  /** "the last 14 days", for the empty state. */
  missedWindowLabel: string;
};

/** "3 days ago", "Yesterday". */
export function howLongAgo(date: IsoDate, today: IsoDate): string {
  const days = daysBetween(date, today);
  if (days <= 1) return "Yesterday";
  if (days < 14) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  return weeks === 1 ? "A week ago" : `${weeks} weeks ago`;
}

/** Groups occurrences by date, newest first, as catch-up rows. */
export function toMissedDays(
  occurrences: Awaited<ReturnType<typeof loadMissed>>,
  today: IsoDate,
  options: { showAssignee: boolean; canSkip: boolean },
): MissedDay[] {
  const byDate = new Map<IsoDate, MissedDay>();

  for (const o of occurrences) {
    let day = byDate.get(o.date);
    if (!day) {
      day = {
        date: o.date,
        heading: relativeDay(o.date, today),
        ago: howLongAgo(o.date, today),
        rows: [],
      };
      byDate.set(o.date, day);
    }
    day.rows.push({
      taskId: o.task.id,
      date: o.date,
      title: o.task.title,
      notes: o.task.notes,
      done: false,
      time: formatTime(o.task.timeOfDay) || null,
      rule: o.task.kind === "recurring" ? describeRule(o.task) : null,
      // Every row here is late; the chip would be on all of them.
      overdue: false,
      assigneeName: o.assignee?.name ?? null,
      showAssignee: options.showAssignee,
      canTick: true,
      canSkip: options.canSkip,
      completedLabel: null,
    });
  }

  return [...byDate.values()];
}

export async function loadTasks(viewer: Viewer): Promise<TasksData> {
  const { household, user } = viewer;
  const today = todayIn(household.timezone);
  const to = shiftDate(today, 13);
  const since = shiftDate(today, -MISSED_WINDOW_DAYS);

  // One calendar load covers both the catch-up window and the fortnight ahead.
  const calendars = await loadCalendars(household, [user.id], since, to);
  const calendar = calendars.for(user.id);

  const [occurrences, missed] = await Promise.all([
    loadOccurrences({
      householdId: household.id,
      from: today,
      to,
      calendars,
      assigneeId: user.id,
    }),
    loadMissed({
      householdId: household.id,
      calendars,
      today,
      since,
      assigneeId: user.id,
    }),
  ]);

  const days = [...isoWeek(today), ...isoWeek(shiftDate(today, 7))]
    .filter((d) => d >= today && d <= to)
    .sort()
    .map((date): TasksDay | null => {
      const forDay = occurrences.filter((o) => o.date === date);
      if (forDay.length === 0) return null;
      return {
        date,
        heading: relativeDay(date, today),
        dateLabel: formatDayDate(date),
        working: calendar.isWorking(date),
        rows: forDay.map((o) => ({
          taskId: o.task.id,
          date: o.date,
          title: o.task.title,
          notes: o.task.notes,
          done: o.done,
          time: formatTime(o.task.timeOfDay) || null,
          rule: o.task.kind === "recurring" ? describeRule(o.task) : null,
          overdue: o.overdue,
          assigneeName: null,
          showAssignee: false,
          canTick: date <= today,
          completedLabel: null,
        })),
      };
    })
    .filter((day): day is TasksDay => day !== null);

  return {
    today,
    total: occurrences.length,
    days,
    missedTotal: missed.length,
    missedDays: toMissedDays(missed, today, {
      showAssignee: false,
      canSkip: false,
    }),
    missedWindowLabel: `the last ${MISSED_WINDOW_DAYS} days`,
  };
}
