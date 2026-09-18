import type { Metadata } from "next";
import Link from "next/link";
import { MenuEditor, type MenuDay } from "@/components/menu-editor";
import {
  IconChevronLeft,
  IconChevronRight,
  buttonClass,
} from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
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
import { loadWorkdayCalendar } from "@/lib/workdays";

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

  const calendar = await loadWorkdayCalendar(
    household,
    shiftDate(monday, -7),
    week[6],
  );
  const meals = await loadMeals(household.id, monday, week[6], calendar);

  function find(date: IsoDate, slot: "lunch" | "dinner"): MealWithPrep | undefined {
    return meals.find((m) => m.date === date && m.slot === slot);
  }

  function cell(date: IsoDate, slot: "lunch" | "dinner") {
    const meal = find(date, slot);
    const prepDate = calendar.previousWorkingDay(date);
    return {
      dish: meal?.dish ?? "",
      notes: meal?.notes ?? "",
      timing: (meal?.prepTiming ?? "same_day") as "same_day" | "day_before",
      prepLabel: `${weekdayShort(prepDate)} ${formatDayNumber(prepDate)}`,
      rolledBack: prepDate !== shiftDate(date, -1),
    };
  }

  const days: MenuDay[] = week.map((date) => ({
    date,
    weekday: weekdayShort(date),
    dayNumber: formatDayNumber(date),
    working: calendar.isWorking(date),
    isToday: date === today,
    lunch: cell(date, "lunch"),
    dinner: cell(date, "dinner"),
  }));

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
        Mark a meal <strong className="font-semibold">day before</strong> and it
        appears on the kitchen list the previous working day, so a Monday dinner
        is prepped on Friday when nobody works the weekend.
      </p>

      <MenuEditor
        days={days}
        monday={monday}
        previousMonday={shiftDate(monday, -7)}
      />
    </div>
  );
}
