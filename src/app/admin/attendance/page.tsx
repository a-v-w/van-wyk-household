import type { Metadata } from "next";
import Link from "next/link";
import {
  AttendanceCalendar,
  type CalendarDay,
} from "@/components/attendance-calendar";
import { AttendanceRangeForm } from "@/components/attendance-range-form";
import { AttendanceTally } from "@/components/attendance-tally";
import {
  Card,
  CardHeader,
  Chip,
  IconChevronLeft,
  IconChevronRight,
  buttonClass,
} from "@/components/ui";
import { firstName, householdEmployee, requireAdmin } from "@/lib/auth";
import {
  endOfMonth,
  formatDayDate,
  formatDayNumber,
  formatMonth,
  isoWeekday,
  monthGrid,
  shiftMonthStart,
  startOfMonth,
  todayIn,
  type IsoDate,
} from "@/lib/dates";
import { loadAttendance, STATUS_LABEL } from "@/lib/workdays";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Attendance" };

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const viewer = await requireAdmin();
  const { household } = viewer;
  const today = todayIn(household.timezone);
  const params = await searchParams;

  // ?month=YYYY-MM, defaulting to the one we are in.
  const requested = params.month?.match(/^\d{4}-\d{2}$/)
    ? `${params.month}-01`
    : today;
  const monthStart: IsoDate = startOfMonth(requested);
  const monthEnd: IsoDate = endOfMonth(monthStart);

  // The grid spills into the neighbouring months, so load those days too.
  const grid = monthGrid(monthStart);
  const { calendar, attendance } = await loadAttendance(
    household,
    monthStart,
    monthEnd,
    today,
  );

  const employee = await householdEmployee(household.id);
  const defaults = new Set(household.workingWeekdays);

  const weeks: CalendarDay[][] = grid.map((week) =>
    week.map((date) => {
      const inMonth = date >= monthStart && date <= monthEnd;
      const status = calendar.statusFor(date);
      const usual = defaults.has(isoWeekday(date)) ? "working" : "off";
      return {
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

  const isThisMonth = startOfMonth(today) === monthStart;
  const previous = shiftMonthStart(monthStart, -1).slice(0, 7);
  const next = shiftMonthStart(monthStart, 1).slice(0, 7);

  return (
    <div className="flex flex-col gap-6 px-5 py-6 lg:px-8 lg:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="font-mono text-xs tracking-widest text-muted uppercase">
            {employee ? firstName(employee) : "The household"} ·{" "}
            {formatMonth(monthStart)}
          </p>
          <h1 className="text-3xl leading-tight font-extrabold tracking-tight">
            Attendance
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/admin/attendance?month=${previous}`}
            className={buttonClass("secondary", "sm")}
          >
            <IconChevronLeft size={16} />
            {formatMonth(shiftMonthStart(monthStart, -1)).split(" ")[0]}
          </Link>
          {!isThisMonth ? (
            <Link
              href="/admin/attendance"
              title="Back to the month we are in"
              className={buttonClass("secondary", "sm")}
            >
              Back to {formatMonth(today).split(" ")[0]}
            </Link>
          ) : null}
          <Link
            href={`/admin/attendance?month=${next}`}
            className={buttonClass("secondary", "sm")}
          >
            {formatMonth(shiftMonthStart(monthStart, 1)).split(" ")[0]}
            <IconChevronRight size={16} />
          </Link>
        </div>
      </header>

      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <span className="label">{formatMonth(monthStart)}</span>
          <span className="text-[13px] text-muted">
            {attendance.inProgress
              ? `Days worked counted to ${formatDayDate(today)}.`
              : monthStart > today
                ? "This month is still ahead, so these are the days planned."
                : "The month is complete."}
          </span>
        </div>
        <AttendanceTally attendance={attendance} showScheduled />
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] xl:items-start">
        <Card className="p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="label">Click a day to record it</span>
            <div className="flex flex-wrap gap-1.5">
              <Chip tone="accent">Worked</Chip>
              <Chip>Off</Chip>
              <Chip tone="danger">Sick</Chip>
              <Chip tone="lock">Leave</Chip>
            </div>
          </div>
          <AttendanceCalendar weeks={weeks} />
        </Card>

        <div className="flex flex-col gap-5">
          <Card className="p-5">
            <div className="mb-4 flex flex-col gap-1">
              <span className="label">Record a run of days</span>
              <p className="text-[13px] text-ink-2">
                For leave booked ahead: pick the first and last day, choose what
                to record, and save. The dates need not be in this month.
              </p>
            </div>
            <AttendanceRangeForm
              defaultFrom={isThisMonth ? today : monthStart}
              defaultTo={isThisMonth ? today : monthStart}
            />
          </Card>

          <Card>
            <CardHeader title={`Recorded in ${formatMonth(monthStart)}`} />
            {attendance.exceptions.length === 0 ? (
              <p className="px-5 pt-1 pb-5 text-sm text-muted">
                Nothing out of the ordinary this month.
              </p>
            ) : (
              <ul className="flex flex-col gap-2 px-5 pt-1 pb-5">
                {attendance.exceptions.map((entry) => (
                  <li
                    key={entry.date}
                    className="flex flex-wrap items-center gap-2 border-b border-line pb-2 text-sm last:border-b-0 last:pb-0"
                  >
                    <span className="font-mono text-xs text-muted tabular">
                      {formatDayDate(entry.date)}
                    </span>
                    <Chip
                      tone={
                        entry.status === "sick"
                          ? "danger"
                          : entry.status === "leave"
                            ? "lock"
                            : entry.status === "working"
                              ? "accent"
                              : "neutral"
                      }
                    >
                      {STATUS_LABEL[entry.status]}
                    </Chip>
                    {entry.date > today ? (
                      <span className="text-xs text-muted">still to come</span>
                    ) : null}
                    {entry.note ? (
                      <span className="min-w-0 flex-1 text-ink-2">
                        {entry.note}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
