import "server-only";

import type { Viewer } from "@/lib/auth";
import {
  formatDate,
  formatDayNumber,
  isoWeek,
  shiftDate,
  startOfIsoWeek,
  todayIn,
  weekdayShort,
  type IsoDate,
} from "@/lib/dates";
import { groupBySlot, loadMeals, SLOT_LABEL } from "@/lib/meals";
import { loadCalendars } from "@/lib/workdays";

/* This week and next on the menu page, already grouped and labelled, as JSON. */

export type MenuMeal = {
  id: number;
  dish: string;
  forWhom: string | null;
  notes: string | null;
  recipeId: number | null;
  /** "Prep on Fri 18" or "Make on the day". */
  prepLabel: string;
  prepDone: boolean;
};

export type MenuSlot = {
  slot: string;
  label: string;
  entries: MenuMeal[];
};

export type MenuDayView = {
  date: IsoDate;
  weekday: string;
  dayNumber: string;
  isToday: boolean;
  /** Whether the viewer works that day. */
  working: boolean;
  /** Slots with nothing planned are left out entirely. */
  slots: MenuSlot[];
};

export type MenuWeek = {
  monday: IsoDate;
  label: string;
  dateLabel: string;
  /** Only the days with something planned. */
  days: MenuDayView[];
};

export type MenuData = {
  today: IsoDate;
  weeks: MenuWeek[];
};

export async function loadMenu(viewer: Viewer): Promise<MenuData> {
  const { household, user } = viewer;
  const today = todayIn(household.timezone);

  const thisMonday = startOfIsoWeek(today);
  const nextMonday = shiftDate(thisMonday, 7);
  const from = thisMonday;
  const to = shiftDate(nextMonday, 6);

  const calendars = await loadCalendars(household, [user.id], from, to);
  const calendar = calendars.for(user.id);
  const meals = await loadMeals(household.id, from, to, calendars);

  const weeks = [
    { monday: thisMonday, label: "This week" },
    { monday: nextMonday, label: "Next week" },
  ].map((week) => ({
    monday: week.monday,
    label: week.label,
    dateLabel: formatDate(week.monday),
    days: isoWeek(week.monday)
      .map((date) => ({
        date,
        weekday: weekdayShort(date),
        dayNumber: formatDayNumber(date),
        isToday: date === today,
        working: calendar.isWorking(date),
        slots: groupBySlot(meals, date).map((group) => ({
          slot: group.slot,
          label: SLOT_LABEL[group.slot],
          entries: group.entries.map((meal) => ({
            id: meal.id,
            dish: meal.dish,
            forWhom: meal.forWhom,
            notes: meal.notes,
            recipeId: meal.recipeId,
            prepLabel:
              meal.prepTiming === "day_before"
                ? `Prep on ${weekdayShort(meal.prepDate)} ${formatDayNumber(meal.prepDate)}`
                : "Make on the day",
            prepDone: meal.prepDone,
          })),
        })),
      }))
      .filter((day) => day.slots.length > 0),
  }));

  return { today, weeks };
}
