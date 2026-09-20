import "server-only";

import type { CalendarDay } from "@/components/attendance-calendar";
import { householdMembers, type Viewer } from "@/lib/auth";
import {
  endOfMonth,
  formatDayDate,
  formatDayNumber,
  formatMonth,
  isoWeekday,
  monthGrid,
  monthValue,
  shiftMonthStart,
  startOfMonth,
  todayIn,
  type IsoDate,
} from "@/lib/dates";
import { loadAttendance, type Attendance } from "@/lib/workdays";

/* Everything the attendance page shows, already shaped and formatted, as JSON. */

export type AttendancePerson = {
  id: number;
  name: string;
  role: "admin" | "employee";
};

export type AdminAttendanceData = {
  today: IsoDate;
  monthStart: IsoDate;
  /** `YYYY-MM`, for the links that keep the month while changing the person. */
  monthValue: string;
  /** e.g. "September 2026". */
  monthLabel: string;
  isThisMonth: boolean;
  /** The months either side: the `YYYY-MM` to link to and the name to show. */
  previous: { value: string; label: string };
  next: { value: string; label: string };
  /** The name of the month we are in, for the "Back to" button. */
  currentMonthName: string;
  /** What the tally card says about how far the counts go. */
  countNote: string;
  people: AttendancePerson[];
  /** Null when nobody is in the household yet. */
  person: AttendancePerson | null;
  weeks: CalendarDay[][];
  attendance: Attendance | null;
  /** Where the range form starts: today when looking at this month, else the first. */
  rangeDefault: IsoDate;
};

function monthName(date: IsoDate): string {
  return formatMonth(date).split(" ")[0];
}

export async function loadAdminAttendance(
  viewer: Viewer,
  query: URLSearchParams,
): Promise<AdminAttendanceData> {
  const { household } = viewer;
  const today = todayIn(household.timezone);

  // ?month=YYYY-MM, defaulting to the one we are in.
  const month = query.get("month");
  const requested = month && /^\d{4}-\d{2}$/.test(month) ? `${month}-01` : today;
  const monthStart: IsoDate = startOfMonth(requested);
  const monthEnd: IsoDate = endOfMonth(monthStart);

  // Whose attendance we are looking at. Everyone can have their own.
  const who = query.get("who");
  const requestedWho = who ? Number(who) : null;
  // Only an id that could be a real row is worth a query.
  const whoIsValid =
    requestedWho !== null &&
    Number.isInteger(requestedWho) &&
    requestedWho > 0 &&
    requestedWho < 2 ** 31;

  // The members list decides whose month this is, but when ?who= names
  // someone their days can load at the same time; the result is kept only if
  // they turn out to be in the household.
  const [people, speculative] = await Promise.all([
    householdMembers(household.id),
    whoIsValid
      ? loadAttendance(household, requestedWho, monthStart, monthEnd, today)
      : null,
  ]);

  const member =
    people.find((p) => p.id === requestedWho) ??
    people.find((p) => p.role === "employee") ??
    people[0] ??
    null;

  const isThisMonth = startOfMonth(today) === monthStart;
  const previousStart = shiftMonthStart(monthStart, -1);
  const nextStart = shiftMonthStart(monthStart, 1);

  const base = {
    today,
    monthStart,
    monthValue: monthValue(monthStart),
    monthLabel: formatMonth(monthStart),
    isThisMonth,
    previous: { value: previousStart.slice(0, 7), label: monthName(previousStart) },
    next: { value: nextStart.slice(0, 7), label: monthName(nextStart) },
    currentMonthName: monthName(today),
    people: people.map((p) => ({ id: p.id, name: p.name, role: p.role })),
    rangeDefault: isThisMonth ? today : monthStart,
  };

  if (!member) {
    return {
      ...base,
      countNote: "",
      person: null,
      weeks: [],
      attendance: null,
    };
  }

  const { calendar, attendance } =
    speculative && member.id === requestedWho
      ? speculative
      : await loadAttendance(household, member.id, monthStart, monthEnd, today);

  const defaults = new Set(household.workingWeekdays);
  const weeks: CalendarDay[][] = monthGrid(monthStart).map((week) =>
    week.map((date) => {
      const inMonth = date >= monthStart && date <= monthEnd;
      const status = calendar.statusFor(date);
      const usual = defaults.has(isoWeekday(date)) ? "working" : "off";
      return {
        userId: member.id,
        date,
        dayNumber: formatDayNumber(date),
        longDate: formatDayDate(date),
        status,
        note: calendar.recordFor(date)?.note ?? null,
        isToday: date === today,
        inMonth,
        exception: status !== usual,
      };
    }),
  );

  const countNote = attendance.inProgress
    ? `Days worked counted to ${formatDayDate(today)}.`
    : monthStart > today
      ? "This month is still ahead, so these are the days planned."
      : "The month is complete.";

  return {
    ...base,
    countNote,
    person: { id: member.id, name: member.name, role: member.role },
    weeks,
    attendance,
  };
}
