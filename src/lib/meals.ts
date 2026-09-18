import "server-only";

import { and, asc, eq, gte, inArray, lte, notInArray } from "drizzle-orm";
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

/** One slot of one day, with however many dishes it holds. */
export type SlotEntries = {
  date: IsoDate;
  slot: MealSlot;
  entries: MealWithPrep[];
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

/** "Lunch for Emma", or just "Lunch" when it is for the whole house. */
export function mealLabel(meal: Pick<Meal, "slot" | "forWhom">): string {
  const who = meal.forWhom?.trim();
  return who ? `${SLOT_LABEL[meal.slot]} for ${who}` : SLOT_LABEL[meal.slot];
}

/**
 * Where a meal's work lands. "On the day" is the meal's own date. "Day before"
 * is the previous *working* day, so a Monday dinner prepped in advance shows up
 * on Friday when nobody works the weekend — and on Saturday when they do.
 */
export function prepDateFor(meal: Meal, calendar: WorkdayCalendar): IsoDate {
  if (meal.prepTiming === "same_day") return meal.date;
  return calendar.previousWorkingDay(meal.date);
}

function decorate(
  meal: Meal,
  calendar: WorkdayCalendar,
  done: Map<number, Date>,
): MealWithPrep {
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

/** Every dish in a date range, decorated with its prep date. */
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
    orderBy: [asc(meals.date), asc(meals.sortOrder), asc(meals.id)],
  });
  const done = await completionsFor(rows.map((r) => r.id));
  return rows.map((meal) => decorate(meal, calendar, done));
}

/**
 * Groups a day's dishes by slot, dropping slots with nothing in them so an
 * empty lunch never shows up as a blank row.
 */
export function groupBySlot(
  dishes: MealWithPrep[],
  date: IsoDate,
): SlotEntries[] {
  return SLOTS.map((slot) => ({
    date,
    slot,
    entries: dishes.filter((m) => m.date === date && m.slot === slot),
  })).filter((group) => group.entries.length > 0);
}

/**
 * What the kitchen owes on one day: the dishes eaten that day, plus any
 * day-before prep for a later meal that lands on this date.
 */
export async function loadDayKitchen(
  householdId: number,
  date: IsoDate,
  calendar: WorkdayCalendar,
): Promise<{
  today: MealWithPrep[];
  todayBySlot: SlotEntries[];
  prepAhead: MealWithPrep[];
}> {
  // Look far enough forward to catch prep rolled back over a long weekend.
  const window = await loadMeals(
    householdId,
    date,
    shiftDate(date, 14),
    calendar,
  );
  const today = window.filter((m) => m.date === date);

  return {
    today,
    todayBySlot: groupBySlot(today, date),
    prepAhead: window
      .filter((m) => m.date !== date && m.prepDate === date)
      .sort((a, b) => (a.date < b.date ? -1 : 1)),
  };
}

/* ------------------------------------------------------------------ writes -- */

export type SlotEntryInput = {
  /** An existing row to update, or null to create one. */
  id: number | null;
  dish: string;
  recipeId: number | null;
  forWhom: string;
  notes: string;
  prepTiming: PrepTiming;
};

/**
 * Makes one slot of one day match the list it is given. Entries with an empty
 * dish are dropped, and anything previously in the slot that is not in the list
 * is deleted — so clearing a field really does remove the meal.
 */
export async function replaceSlot(
  householdId: number,
  date: IsoDate,
  slot: MealSlot,
  entries: SlotEntryInput[],
): Promise<void> {
  const wanted = entries
    .map((entry) => ({
      ...entry,
      dish: entry.dish.trim(),
      forWhom: entry.forWhom.trim(),
      notes: entry.notes.trim(),
    }))
    .filter((entry) => entry.dish.length > 0);

  const keepIds = wanted
    .map((entry) => entry.id)
    .filter((id): id is number => typeof id === "number");

  const slotFilter = and(
    eq(meals.householdId, householdId),
    eq(meals.date, date),
    eq(meals.slot, slot),
  );

  await db
    .delete(meals)
    .where(
      keepIds.length > 0
        ? and(slotFilter, notInArray(meals.id, keepIds))
        : slotFilter,
    );

  for (const [index, entry] of wanted.entries()) {
    const values = {
      dish: entry.dish,
      recipeId: entry.recipeId,
      forWhom: entry.forWhom || null,
      notes: entry.notes || null,
      prepTiming: entry.prepTiming,
      sortOrder: index,
    };

    if (entry.id) {
      await db.update(meals).set(values).where(
        and(eq(meals.id, entry.id), slotFilter),
      );
    } else {
      await db.insert(meals).values({ householdId, date, slot, ...values });
    }
  }
}

/** Ticks or unticks one dish's cooking or prep. */
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

/** Copies a whole week's menu onto another week, replacing what is there. */
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
    orderBy: [asc(meals.date), asc(meals.sortOrder), asc(meals.id)],
  });

  const offset = Math.round(
    (Date.parse(toMonday) - Date.parse(fromMonday)) / 86_400_000,
  );

  for (let day = 0; day < 7; day++) {
    const sourceDate = shiftDate(fromMonday, day);
    const targetDate = shiftDate(sourceDate, offset);

    for (const slot of SLOTS) {
      await replaceSlot(
        householdId,
        targetDate,
        slot,
        source
          .filter((m) => m.date === sourceDate && m.slot === slot)
          .map((m) => ({
            id: null,
            dish: m.dish,
            recipeId: m.recipeId,
            forWhom: m.forWhom ?? "",
            notes: m.notes ?? "",
            prepTiming: m.prepTiming,
          })),
      );
    }
  }

  return source.length;
}
