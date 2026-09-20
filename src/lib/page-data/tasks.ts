import "server-only";

import type { TaskRowData } from "@/components/task-list";
import type { Viewer } from "@/lib/auth";
import {
  formatDayDate,
  formatTime,
  isoWeek,
  relativeDay,
  shiftDate,
  todayIn,
  type IsoDate,
} from "@/lib/dates";
import { describeRule, loadOccurrences } from "@/lib/tasks";
import { loadCalendars } from "@/lib/workdays";

/* The signed-in person's tasks for the next two weeks, grouped by day. */

export type TasksDay = {
  date: IsoDate;
  /** "Today", "Tomorrow" or the short date. */
  heading: string;
  dateLabel: string;
  working: boolean;
  rows: TaskRowData[];
};

export type TasksData = {
  today: IsoDate;
  total: number;
  days: TasksDay[];
};

export async function loadTasks(viewer: Viewer): Promise<TasksData> {
  const { household, user } = viewer;
  const today = todayIn(household.timezone);
  const to = shiftDate(today, 13);

  // The occurrences are expanded against the calendar, so it comes first.
  const calendars = await loadCalendars(household, [user.id], today, to);
  const calendar = calendars.for(user.id);
  const occurrences = await loadOccurrences({
    householdId: household.id,
    from: today,
    to,
    calendars,
    assigneeId: user.id,
  });

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

  return { today, total: occurrences.length, days };
}
