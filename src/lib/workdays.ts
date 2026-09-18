import "server-only";

import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { workdayOverrides, type Household } from "@/db/schema";
import { isoWeekday, shiftDate, type IsoDate } from "@/lib/dates";

/**
 * Which days the employee works. The household has a default weekday set
 * (Monday to Friday), and the admin can mark individual dates as working or
 * off — a Saturday she is asked in for, a weekday she is away.
 */
export type WorkdayCalendar = {
  isWorking: (date: IsoDate) => boolean;
  /** The last working day strictly before `date`. */
  previousWorkingDay: (date: IsoDate) => IsoDate;
  /** Dates in the loaded range that the admin has explicitly overridden. */
  overrides: Map<IsoDate, boolean>;
};

/**
 * Builds a calendar for a date range. The range is padded by a week on each
 * side so `previousWorkingDay` can look backwards across it.
 */
export async function loadWorkdayCalendar(
  household: Household,
  from: IsoDate,
  to: IsoDate,
): Promise<WorkdayCalendar> {
  const paddedFrom = shiftDate(from, -14);
  const paddedTo = shiftDate(to, 14);

  const rows = await db.query.workdayOverrides.findMany({
    where: and(
      eq(workdayOverrides.householdId, household.id),
      gte(workdayOverrides.date, paddedFrom),
      lte(workdayOverrides.date, paddedTo),
    ),
  });

  const overrides = new Map<IsoDate, boolean>(
    rows.map((row) => [row.date, row.isWorking]),
  );
  return buildCalendar(household, overrides);
}

export function buildCalendar(
  household: Household,
  overrides: Map<IsoDate, boolean>,
): WorkdayCalendar {
  const defaults = new Set(household.workingWeekdays);

  function isWorking(date: IsoDate): boolean {
    const override = overrides.get(date);
    if (override !== undefined) return override;
    return defaults.has(isoWeekday(date));
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

  return { isWorking, previousWorkingDay, overrides };
}

/** Marks a single date as a working day, or clears the override. */
export async function setWorkday(
  householdId: number,
  date: IsoDate,
  isWorking: boolean | null,
  note?: string | null,
): Promise<void> {
  if (isWorking === null) {
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
    .values({ householdId, date, isWorking, note: note ?? null })
    .onConflictDoUpdate({
      target: [workdayOverrides.householdId, workdayOverrides.date],
      set: { isWorking, note: note ?? null },
    });
}
