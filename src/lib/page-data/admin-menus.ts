import "server-only";

import type { MenuDay, MenuEntry } from "@/components/menu-editor";
import { householdStaff, type Viewer } from "@/lib/auth";
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
import { householdLists } from "@/lib/groceries";
import { loadMeals, type MealWithPrep } from "@/lib/meals";
import { recipeOptions } from "@/lib/recipes";
import { shoppedMealIds } from "@/lib/shopping";
import { loadCalendars } from "@/lib/workdays";

/* One week of the menu editor, already shaped for the client, as JSON. */

export type AdminMenusData = {
  today: IsoDate;
  monday: IsoDate;
  weekEnd: IsoDate;
  previousMonday: IsoDate;
  nextMonday: IsoDate;
  /** "This week", "Next week", "Last week" or "Week of". */
  label: string;
  days: MenuDay[];
  recipes: { id: number; title: string }[];
  groceryLists: { id: number; name: string }[];
};

export async function loadAdminMenus(
  viewer: Viewer,
  query: URLSearchParams,
): Promise<AdminMenusData> {
  const { household } = viewer;
  const today = todayIn(household.timezone);

  const requestedWeek = query.get("week");
  const requested = requestedWeek?.match(/^\d{4}-\d{2}-\d{2}$/)
    ? requestedWeek
    : today;
  const monday: IsoDate = startOfIsoWeek(requested);
  const week = isoWeek(monday);

  // The calendars need the staff; everything else only needs the calendars.
  const staff = await householdStaff(household.id);
  const calendars = await loadCalendars(
    household,
    staff.map((person) => person.id),
    shiftDate(monday, -7),
    week[6],
  );
  const [meals, recipes, lists, shopped] = await Promise.all([
    loadMeals(household.id, monday, week[6], calendars),
    recipeOptions(household.id),
    householdLists(household),
    // Which dishes have already been shopped for, so the button says so.
    shoppedMealIds(household.id, monday, week[6]),
  ]);

  function entries(date: IsoDate, slot: "lunch" | "dinner"): MenuEntry[] {
    return meals
      .filter((m: MealWithPrep) => m.date === date && m.slot === slot)
      .map((m) => ({
        id: m.id,
        dish: m.dish,
        recipeId: m.recipeId,
        onShoppingList: shopped.has(m.id),
        forWhom: m.forWhom ?? "",
        notes: m.notes ?? "",
        prepTiming: m.prepTiming,
      }));
  }

  const days: MenuDay[] = week.map((date) => {
    const prepDate = calendars.previousWorkingDay(date);
    return {
      date,
      weekday: weekdayShort(date),
      dayNumber: formatDayNumber(date),
      working: calendars.anyoneWorking(date),
      isToday: date === today,
      prepLabel: `${weekdayShort(prepDate)} ${formatDayNumber(prepDate)}`,
      prepRolledBack: prepDate !== shiftDate(date, -1),
      lunch: entries(date, "lunch"),
      dinner: entries(date, "dinner"),
    };
  });

  const thisMonday = startOfIsoWeek(today);
  const label =
    monday === thisMonday
      ? "This week"
      : monday === shiftDate(thisMonday, 7)
        ? "Next week"
        : monday === shiftDate(thisMonday, -7)
          ? "Last week"
          : "Week of";

  return {
    today,
    monday,
    weekEnd: week[6],
    previousMonday: shiftDate(monday, -7),
    nextMonday: shiftDate(monday, 7),
    label: `${label} · ${formatDate(monday)} to ${formatDate(week[6])}`,
    days,
    recipes,
    groceryLists: lists.map((l) => ({ id: l.id, name: l.name })),
  };
}
