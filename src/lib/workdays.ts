import "server-only";

import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import {
  workdayOverrides,
  type Household,
  type WorkdayStatus,
} from "@/db/schema";
import { datesBetween, isoWeekday, shiftDate, type IsoDate } from "@/lib/dates";

export type DayRecord = {
  status: WorkdayStatus;
  note: string | null;
};

/**
 * Which days the employee works, and why a day was different. The household has
 * a default weekday set; individual dates can be marked worked, sick, on leave
 * or simply off, and only "working" counts as a working day.
 */
export type WorkdayCalendar = {
  isWorking: (date: IsoDate) => boolean;
  /** The recorded exception for a date, or null when it follows the pattern. */
  recordFor: (date: IsoDate) => DayRecord | null;
  /** What actually happened, pattern included. */
  statusFor: (date: IsoDate) => WorkdayStatus;
  /** The last working day strictly before `date`. */
  previousWorkingDay: (date: IsoDate) => IsoDate;
  records: Map<IsoDate, DayRecord>;
};

export {
  STATUS_ACTION,
  STATUS_CHOICES,
  STATUS_LABEL,
} from "@/lib/workday-constants";

/**
 * Builds a calendar for a date range. The range is padded on each side so
 * `previousWorkingDay` can look backwards across it.
 */
export async function loadWorkdayCalendar(
  household: Household,
  from: IsoDate,
  to: IsoDate,
): Promise<WorkdayCalendar> {
  const rows = await db.query.workdayOverrides.findMany({
    where: and(
      eq(workdayOverrides.householdId, household.id),
      gte(workdayOverrides.date, shiftDate(from, -21)),
      lte(workdayOverrides.date, shiftDate(to, 21)),
    ),
  });

  return buildCalendar(
    household,
    new Map(rows.map((row) => [row.date, { status: row.status, note: row.note }])),
  );
}

export function buildCalendar(
  household: Household,
  records: Map<IsoDate, DayRecord>,
): WorkdayCalendar {
  const defaults = new Set(household.workingWeekdays);

  function recordFor(date: IsoDate): DayRecord | null {
    return records.get(date) ?? null;
  }

  function statusFor(date: IsoDate): WorkdayStatus {
    const record = records.get(date);
    if (record) return record.status;
    return defaults.has(isoWeekday(date)) ? "working" : "off";
  }

  function isWorking(date: IsoDate): boolean {
    return statusFor(date) === "working";
  }

  function previousWorkingDay(date: IsoDate): IsoDate {
    // Look back at most a fortnight; beyond that, fall back to the day before
    // so a prep item never disappears entirely.
    for (let i = 1; i <= 14; i++) {
      const candidate = shiftDate(date, -i);
      if (isWorking(candidate)) return candidate;
    }
    return shiftDate(date, -1);
  }

  return { isWorking, recordFor, statusFor, previousWorkingDay, records };
}

/**
 * Records what happened on one date. Passing null clears the record, so the
 * date goes back to following the household's usual pattern.
 */
export async function setWorkday(
  householdId: number,
  date: IsoDate,
  status: WorkdayStatus | null,
  note: string | null,
  recordedBy: number | null,
): Promise<void> {
  if (status === null) {
    await db
      .delete(workdayOverrides)
      .where(
        and(
          eq(workdayOverrides.householdId, householdId),
          eq(workdayOverrides.date, date),
        ),
      );
    return;
  }

  await db
    .insert(workdayOverrides)
    .values({ householdId, date, status, note, recordedBy })
    .onConflictDoUpdate({
      target: [workdayOverrides.householdId, workdayOverrides.date],
      set: { status, note, recordedBy },
    });
}

/* ------------------------------------------------------------- attendance -- */

export type Attendance = {
  from: IsoDate;
  to: IsoDate;
  /** Days actually worked, counting only dates that have already happened. */
  worked: number;
  /** Of those, days worked outside the usual weekday pattern. */
  extra: number;
  sick: number;
  leave: number;
  /** Days off that were not sick or leave, excluding the usual days off. */
  off: number;
  /** Every recorded exception in the range, most recent first. */
  exceptions: { date: IsoDate; status: WorkdayStatus; note: string | null }[];
};

/**
 * Counts up a stretch of the calendar. Only dates up to `upTo` are counted as
 * worked, so a part-finished month does not look like a full one.
 */
export function summariseAttendance(
  household: Household,
  calendar: WorkdayCalendar,
  from: IsoDate,
  to: IsoDate,
  upTo: IsoDate,
): Attendance {
  const defaults = new Set(household.workingWeekdays);
  const summary: Attendance = {
    from,
    to,
    worked: 0,
    extra: 0,
    sick: 0,
    leave: 0,
    off: 0,
    exceptions: [],
  };

  for (const date of datesBetween(from, to)) {
    const status = calendar.statusFor(date);
    const record = calendar.recordFor(date);
    const usualWorkday = defaults.has(isoWeekday(date));

    if (date <= upTo && status === "working") {
      summary.worked += 1;
      if (!usualWorkday) summary.extra += 1;
    }
    if (status === "sick") summary.sick += 1;
    if (status === "leave") summary.leave += 1;
    if (status === "off" && usualWorkday) summary.off += 1;

    if (record) {
      summary.exceptions.push({
        date,
        status: record.status,
        note: record.note,
      });
    }
  }

  summary.exceptions.reverse();
  return summary;
}

/** Loads a calendar for a range and summarises it in one go. */
export async function loadAttendance(
  household: Household,
  from: IsoDate,
  to: IsoDate,
  upTo: IsoDate,
): Promise<{ calendar: WorkdayCalendar; attendance: Attendance }> {
  const calendar = await loadWorkdayCalendar(household, from, to);
  return {
    calendar,
    attendance: summariseAttendance(household, calendar, from, to, upTo),
  };
}
