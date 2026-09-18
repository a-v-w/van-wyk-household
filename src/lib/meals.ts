import "server-only";

import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import {
  mealCompletions,
  meals,
  type Meal,
  type MealSlot,
  type PrepTiming,
} from "@/db/schema";
import { shiftDate, type IsoDate } from "@/lib/dates";
import type { WorkdayCalendar } from "@/lib/workdays";

export type MealWithPrep = Meal & {
  /** The day the cooking or prep work actually lands on. */
  prepDate: IsoDate;
  prepDone: boolean;
  prepCompletedAt: Date | null;
  /** True when day-before prep was pushed back past a non-working day. */
  rolledBack: boolean;
};

export const SLOTS: MealSlot[] = ["lunch", "dinner"];

export const SLOT_LABEL: Record<MealSlot, string> = {
  lunch: "Lunch",
  dinner: "Dinner",
};

export const PREP_LABEL: Record<PrepTiming, string> = {
  same_day: "On the day",
  day_before: "Day before",
};

/**
 * Where a meal's work lands. "On the day" is the meal's own date. "Day before"
 * is the previous *working* day, so a Monday dinner prepped in advance shows up
 * on Friday when nobody works the weekend — and on Saturday when they do.
 */
export function prepDateFor(meal: Meal, calendar: WorkdayCalendar): IsoDate {
  if (meal.prepTiming === "same_day") return meal.date;
  return calendar.previousWorkingDay(meal.date);
}

function decorate(meal: Meal, calendar: WorkdayCalendar, done: Map<number, Date>): MealWithPrep {
  const prepDate = prepDateFor(meal, calendar);
  const completedAt = done.get(meal.id) ?? null;
  return {
    ...meal,
    prepDate,
    prepDone: completedAt !== null,
    prepCompletedAt: completedAt,
    rolledBack:
      meal.prepTiming === "day_before" && prepDate !== shiftDate(meal.date, -1),
  };
}

async function completionsFor(mealIds: number[]): Promise<Map<number, Date>> {
  if (mealIds.length === 0) return new Map();
  const rows = await db.query.mealCompletions.findMany({
    where: inArray(mealCompletions.mealId, mealIds),
  });
  return new Map(rows.map((r) => [r.mealId, r.completedAt]));
}

/** Every meal in a date range, decorated with its prep date. */
export async function loadMeals(
  householdId: number,
  from: IsoDate,
  to: IsoDate,
  calendar: WorkdayCalendar,
): Promise<MealWithPrep[]> {
  const rows = await db.query.meals.findMany({
    where: and(
      eq(meals.householdId, householdId),
      gte(meals.date, from),
      lte(meals.date, to),
    ),
  });
  const done = await completionsFor(rows.map((r) => r.id));
  return rows.map((meal) => decorate(meal, calendar, done));
}

/**
 * What the kitchen owes on one day: the meals eaten that day, plus any
 * day-before prep for a later meal that lands on this date.
 */
export async function loadDayKitchen(
  householdId: number,
  date: IsoDate,
  calendar: WorkdayCalendar,
): Promise<{ today: MealWithPrep[]; prepAhead: MealWithPrep[] }> {
  // Look far enough forward to catch prep rolled back over a long weekend.
  const window = await loadMeals(
    householdId,
    date,
    shiftDate(date, 14),
    calendar,
  );
  return {
    today: window
      .filter((m) => m.date === date)
      .sort((a, b) => SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot)),
    prepAhead: window
      .filter((m) => m.date !== date && m.prepDate === date)
      .sort((a, b) => (a.date < b.date ? -1 : 1)),
  };
}

/** Creates or updates one slot of one day. An empty dish clears the slot. */
export async function setMeal(
  householdId: number,
  date: IsoDate,
  slot: MealSlot,
  dish: string,
  notes: string | null,
  prepTiming: PrepTiming,
): Promise<void> {
  const trimmed = dish.trim();

  if (!trimmed) {
    await db
      .delete(meals)
      .where(
        and(
          eq(meals.householdId, householdId),
          eq(meals.date, date),
          eq(meals.slot, slot),
        ),
      );
    return;
  }

  await db
    .insert(meals)
    .values({
      householdId,
      date,
      slot,
      dish: trimmed,
      notes: notes?.trim() || null,
      prepTiming,
    })
    .onConflictDoUpdate({
      target: [meals.householdId, meals.date, meals.slot],
      set: { dish: trimmed, notes: notes?.trim() || null, prepTiming },
    });
}

/** Ticks or unticks a meal's cooking/prep. */
export async function setMealDone(
  mealId: number,
  done: boolean,
  userId: number,
): Promise<void> {
  if (done) {
    await db
      .insert(mealCompletions)
      .values({ mealId, completedBy: userId })
      .onConflictDoNothing({ target: [mealCompletions.mealId] });
    return;
  }
  await db.delete(mealCompletions).where(eq(mealCompletions.mealId, mealId));
}

/** Copies a whole week's menu onto another week, overwriting what is there. */
export async function copyWeek(
  householdId: number,
  fromMonday: IsoDate,
  toMonday: IsoDate,
): Promise<number> {
  const source = await db.query.meals.findMany({
    where: and(
      eq(meals.householdId, householdId),
      gte(meals.date, fromMonday),
      lte(meals.date, shiftDate(fromMonday, 6)),
    ),
  });
  if (source.length === 0) return 0;

  const offset = Math.round(
    (Date.parse(toMonday) - Date.parse(fromMonday)) / 86_400_000,
  );

  for (const meal of source) {
    await setMeal(
      householdId,
      shiftDate(meal.date, offset),
      meal.slot,
      meal.dish,
      meal.notes,
      meal.prepTiming,
    );
  }
  return source.length;
}
