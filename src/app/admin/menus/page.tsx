import type { Metadata } from "next";
import Link from "next/link";
import { MenuEditor, type MenuDay, type MenuEntry } from "@/components/menu-editor";
import {
  IconChevronLeft,
  IconChevronRight,
  buttonClass,
} from "@/components/ui";
import { householdStaff, requireAdmin } from "@/lib/auth";
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
import { loadMeals, type MealWithPrep } from "@/lib/meals";
import { householdLists } from "@/lib/groceries";
import { recipeOptions } from "@/lib/recipes";
import { shoppedMealIds } from "@/lib/shopping";
import { loadCalendars } from "@/lib/workdays";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Menus" };

export default async function AdminMenusPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const viewer = await requireAdmin();
  const { household } = viewer;
  const today = todayIn(household.timezone);
  const params = await searchParams;

  const requested = params.week?.match(/^\d{4}-\d{2}-\d{2}$/)
    ? params.week
    : today;
  const monday: IsoDate = startOfIsoWeek(requested);
  const week = isoWeek(monday);

  const staff = await householdStaff(household.id);
  const calendars = await loadCalendars(
    household,
    staff.map((person) => person.id),
    shiftDate(monday, -7),
    week[6],
  );
  const meals = await loadMeals(household.id, monday, week[6], calendars);
  const recipes = await recipeOptions(household.id);
  const lists = await householdLists(household);
  // Which dishes have already been shopped for, so the button says so.
  const shopped = await shoppedMealIds(household.id, monday, week[6]);

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

  return (
    <div className="flex flex-col gap-5 px-5 py-6 lg:px-8 lg:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="font-mono text-xs tracking-widest text-muted uppercase">
            {label} · {formatDate(monday)} to {formatDate(week[6])}
          </p>
          <h1 className="text-3xl leading-tight font-extrabold tracking-tight">
            Menu
          </h1>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/admin/menus?week=${shiftDate(monday, -7)}`}
            className={buttonClass("secondary", "sm")}
          >
            <IconChevronLeft size={16} />
            Previous
          </Link>
          <Link
            href={`/admin/menus?week=${shiftDate(monday, 7)}`}
            className={buttonClass("secondary", "sm")}
          >
            Next
            <IconChevronRight size={16} />
          </Link>
        </div>
      </header>

      <p className="max-w-2xl text-sm text-ink-2">
        A slot can hold more than one dish, so name who each is for when people
        eat differently. Mark a dish{" "}
        <strong className="font-semibold">day before</strong> and it appears on
        the kitchen list the previous working day, so a Monday dinner is prepped
        on Friday when nobody works the weekend.
      </p>

      <MenuEditor
        days={days}
        monday={monday}
        previousMonday={shiftDate(monday, -7)}
        recipes={recipes}
        groceryLists={lists.map((l) => ({ id: l.id, name: l.name }))}
      />
    </div>
  );
}
