import "server-only";

import type { PrepRowData, TaskRowData } from "@/components/task-list";
import type { Viewer } from "@/lib/auth";
import {
  formatLongDate,
  formatTime,
  relativeDay,
  todayIn,
  weekdayName,
  type IsoDate,
} from "@/lib/dates";
import {
  currentCycle,
  currentLockDate,
  loadCycleView,
  resolveList,
} from "@/lib/groceries";
import { loadDayKitchen, SLOT_LABEL } from "@/lib/meals";
import { describeRule, loadOccurrences } from "@/lib/tasks";
import { loadCalendars } from "@/lib/workdays";

/* Everything the Today page shows, already shaped and formatted, as JSON. */

export type TodayMeal = {
  id: number;
  dish: string;
  forWhom: string | null;
  notes: string | null;
  recipeId: number | null;
  prepTiming: "same_day" | "day_before";
  prepDone: boolean;
};

export type TodayData = {
  today: IsoDate;
  dateLabel: string;
  weekday: string;
  /** Whether the viewer works today. */
  working: boolean;
  /** Only on the day a weekly list closes; null otherwise. */
  lockBanner: {
    listName: string;
    /** The lock instant, as ISO. */
    locksAt: string;
    /** The lock time in the household zone, e.g. "17:00". */
    timeLabel: string;
    orderDate: IsoDate | null;
    itemCount: number;
    href: string;
  } | null;
  tasks: {
    done: number;
    total: number;
    rows: TaskRowData[];
  };
  prepAhead: PrepRowData[];
  /** Only slots with something in them, so an unplanned lunch is absent. */
  mealSlots: { slot: string; label: string; entries: TodayMeal[] }[];
};

export async function loadToday(viewer: Viewer): Promise<TodayData> {
  const { household, user } = viewer;
  const today: IsoDate = todayIn(household.timezone);

  const calendars = await loadCalendars(household, [user.id], today, today);
  const calendar = calendars.for(user.id);
  const working = calendar.isWorking(today);

  const [occurrences, kitchen, list] = await Promise.all([
    loadOccurrences({
      householdId: household.id,
      from: today,
      to: today,
      calendars,
      assigneeId: user.id,
      includeOverdue: true,
    }),
    loadDayKitchen(household.id, today, calendars),
    resolveList(household),
  ]);

  // Only the list that closes today nudges, and only before it closes.
  const cycle = list ? await currentCycle(household, list) : null;
  const view = cycle && list ? await loadCycleView(list, cycle) : null;
  const showLockBanner =
    Boolean(list) &&
    list.kind === "weekly" &&
    currentLockDate(household, list) === today;
  const pendingCount =
    view?.items.filter((i) => i.status === "pending").length ?? 0;

  const lockBanner: TodayData["lockBanner"] =
    showLockBanner && view?.locksAt && list && cycle
      ? {
          listName: list.name,
          locksAt: view.locksAt.toISOString(),
          timeLabel: view.locksAt.toLocaleTimeString("en-ZA", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
            timeZone: household.timezone,
          }),
          orderDate: cycle.orderDate,
          itemCount: pendingCount,
          href: `/groceries?list=${list.id}`,
        }
      : null;

  const rows: TaskRowData[] = occurrences.map((o) => ({
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
    canTick: true,
    completedLabel: o.completedAt
      ? `Done ${o.completedAt.toLocaleTimeString("en-ZA", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: household.timezone,
        })}`
      : null,
  }));

  const prepAhead: PrepRowData[] = kitchen.prepAhead.map((meal) => ({
    mealId: meal.id,
    title: `Prep ${weekdayName(meal.date).toLowerCase()}'s ${meal.slot}${
      meal.forWhom ? ` for ${meal.forWhom}` : ""
    }: ${meal.dish}`,
    notes: meal.notes,
    done: meal.prepDone,
    chip: `For ${relativeDay(meal.date, today).toLowerCase()}`,
    rolledBackFrom: meal.rolledBack
      ? `the day before ${weekdayName(meal.date).toLowerCase()}`
      : null,
    canTick: true,
  }));

  const mealSlots = kitchen.todayBySlot.map((group) => ({
    slot: group.slot,
    label: SLOT_LABEL[group.slot],
    entries: group.entries.map((meal) => ({
      id: meal.id,
      dish: meal.dish,
      forWhom: meal.forWhom,
      notes: meal.notes,
      recipeId: meal.recipeId,
      prepTiming: meal.prepTiming,
      prepDone: meal.prepDone,
    })),
  }));

  return {
    today,
    dateLabel: formatLongDate(today),
    weekday: weekdayName(today),
    working,
    lockBanner,
    tasks: {
      done: occurrences.filter((o) => o.done).length,
      total: occurrences.length,
      rows,
    },
    prepAhead,
    mealSlots,
  };
}
