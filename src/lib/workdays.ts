import "server-only";

import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import {
  workdayOverrides,
  type Household,
  type WorkdayStatus,
} from "@/db/schema";
import { datesBetween, isoWeekday, shiftDate, type IsoDate } from "@/lib/dates";

export {
  STATUS_ACTION,
  STATUS_CHOICES,
  STATUS_LABEL,
} from "@/lib/workday-constants";

export type DayRecord = {
  status: WorkdayStatus;
  note: string | null;
};

/**
 * One person's working days. The household has a default weekday set; any
 * single date can be recorded as worked, off, sick or on leave, and only
 * "working" counts as a working day.
 */
export type WorkdayCalendar = {
  userId: number | null;
  isWorking: (date: IsoDate) => boolean;
  /** The recorded exception for a date, or null when it follows the pattern. */
  recordFor: (date: IsoDate) => DayRecord | null;
  /** What actually happened, pattern included. */
  statusFor: (date: IsoDate) => WorkdayStatus;
  /** The last working day strictly before `date`. */
  previousWorkingDay: (date: IsoDate) => IsoDate;
  records: Map<IsoDate, DayRecord>;
};

/** Everyone's calendars at once, keyed by user id. */
export type CalendarSet = {
  for: (userId: number | null | undefined) => WorkdayCalendar;
  /** True when at least one of the people works that day. */
  anyoneWorking: (date: IsoDate) => boolean;
  /** The last day anybody worked, for kitchen prep that belongs to no one. */
  previousWorkingDay: (date: IsoDate) => IsoDate;
  all: WorkdayCalendar[];
};

function buildCalendar(
  household: Household,
  userId: number | null,
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

  return { userId, isWorking, recordFor, statusFor, previousWorkingDay, records };
}

/** A calendar for someone with nothing recorded: the plain weekday pattern. */
export function patternCalendar(
  household: Household,
  userId: number | null = null,
): WorkdayCalendar {
  return buildCalendar(household, userId, new Map());
}

/**
 * Loads one person's calendar for a date range, padded on each side so
 * `previousWorkingDay` can look backwards across it.
 */
export async function loadWorkdayCalendar(
  household: Household,
  userId: number,
  from: IsoDate,
  to: IsoDate,
): Promise<WorkdayCalendar> {
  const rows = await db.query.workdayOverrides.findMany({
    where: and(
      eq(workdayOverrides.userId, userId),
      gte(workdayOverrides.date, shiftDate(from, -21)),
      lte(workdayOverrides.date, shiftDate(to, 21)),
    ),
  });

  return buildCalendar(
    household,
    userId,
    new Map(rows.map((row) => [row.date, { status: row.status, note: row.note }])),
  );
}

/**
 * Loads calendars for several people in one query. Anything that spans the
 * household — a task list covering everyone, the kitchen — uses this so each
 * person is judged against their own days.
 */
export async function loadCalendars(
  household: Household,
  userIds: number[],
  from: IsoDate,
  to: IsoDate,
): Promise<CalendarSet> {
  const rows =
    userIds.length === 0
      ? []
      : await db.query.workdayOverrides.findMany({
          where: and(
            inArray(workdayOverrides.userId, userIds),
            gte(workdayOverrides.date, shiftDate(from, -21)),
            lte(workdayOverrides.date, shiftDate(to, 21)),
          ),
        });

  const byUser = new Map<number, Map<IsoDate, DayRecord>>();
  for (const id of userIds) byUser.set(id, new Map());
  for (const row of rows) {
    byUser
      .get(row.userId)
      ?.set(row.date, { status: row.status, note: row.note });
  }

  const calendars = new Map<number, WorkdayCalendar>();
  for (const id of userIds) {
    calendars.set(id, buildCalendar(household, id, byUser.get(id) ?? new Map()));
  }

  // Someone with no account of their own still gets the household pattern.
  const fallback = patternCalendar(household);
  const all = [...calendars.values()];

  function anyoneWorking(date: IsoDate): boolean {
    if (all.length === 0) return fallback.isWorking(date);
    return all.some((calendar) => calendar.isWorking(date));
  }

  function previousWorkingDay(date: IsoDate): IsoDate {
    for (let i = 1; i <= 14; i++) {
      const candidate = shiftDate(date, -i);
      if (anyoneWorking(candidate)) return candidate;
    }
    return shiftDate(date, -1);
  }

  return {
    for: (userId) =>
      (userId != null ? calendars.get(userId) : undefined) ?? fallback,
    anyoneWorking,
    previousWorkingDay,
    all,
  };
}

/**
 * Records what happened on one date for one person. Passing null clears the
 * record, so the date goes back to the usual pattern.
 */
export async function setWorkday(
  householdId: number,
  userId: number,
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
          eq(workdayOverrides.userId, userId),
          eq(workdayOverrides.date, date),
        ),
      );
    return;
  }

  await db
    .insert(workdayOverrides)
    .values({ householdId, userId, date, status, note, recordedBy })
    .onConflictDoUpdate({
      target: [workdayOverrides.userId, workdayOverrides.date],
      set: { status, note, recordedBy },
    });
}

/* ------------------------------------------------------------- attendance -- */

export type Attendance = {
  from: IsoDate;
  to: IsoDate;
  /** Days actually worked, counting only dates that have already happened. */
  worked: number;
  /** Working days across the whole range, future included. */
  scheduled: number;
  /** Of the days worked, those outside the usual weekday pattern. */
  extra: number;
  sick: number;
  leave: number;
  /** Days off that were not sick or leave, excluding the usual days off. */
  off: number;
  /** True when the range has not finished yet, so counts are partial. */
  inProgress: boolean;
  /** Every recorded exception in the range, most recent first. */
  exceptions: { date: IsoDate; status: WorkdayStatus; note: string | null }[];
};

/**
 * Counts up a stretch of one person's calendar. Only dates up to `upTo` are
 * counted as worked, so a part-finished month does not look like a full one.
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
    scheduled: 0,
    extra: 0,
    sick: 0,
    leave: 0,
    off: 0,
    inProgress: upTo >= from && upTo < to,
    exceptions: [],
  };

  for (const date of datesBetween(from, to)) {
    const status = calendar.statusFor(date);
    const record = calendar.recordFor(date);
    const usualWorkday = defaults.has(isoWeekday(date));

    if (status === "working") summary.scheduled += 1;

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

/**
 * Records the same status across a stretch of dates for one person, which is
 * how a block of leave gets logged months ahead of time.
 */
export async function setWorkdayRange(
  householdId: number,
  userId: number,
  from: IsoDate,
  to: IsoDate,
  status: WorkdayStatus,
  note: string | null,
  recordedBy: number | null,
  /** Skip dates that are already days off under the usual pattern. */
  onlyUsualWorkdays: boolean,
  usualWeekdays: number[],
): Promise<number> {
  const defaults = new Set(usualWeekdays);
  let written = 0;

  for (const date of datesBetween(from, to)) {
    if (onlyUsualWorkdays && !defaults.has(isoWeekday(date))) continue;
    await setWorkday(householdId, userId, date, status, note, recordedBy);
    written += 1;
  }

  return written;
}

/** Removes one person's records in a range, back to the usual pattern. */
export async function clearWorkdayRange(
  userId: number,
  from: IsoDate,
  to: IsoDate,
): Promise<void> {
  await db
    .delete(workdayOverrides)
    .where(
      and(
        eq(workdayOverrides.userId, userId),
        gte(workdayOverrides.date, from),
        lte(workdayOverrides.date, to),
      ),
    );
}

/** Loads one person's calendar for a range and summarises it in one go. */
export async function loadAttendance(
  household: Household,
  userId: number,
  from: IsoDate,
  to: IsoDate,
  upTo: IsoDate,
): Promise<{ calendar: WorkdayCalendar; attendance: Attendance }> {
  const calendar = await loadWorkdayCalendar(household, userId, from, to);
  return {
    calendar,
    attendance: summariseAttendance(household, calendar, from, to, upTo),
  };
}
