"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { meals, type MealSlot, type PrepTiming } from "@/db/schema";
import { requireAdmin, requireViewer } from "@/lib/auth";
import {
  copyWeek,
  replaceSlot,
  setMealDone,
  SLOTS,
  type SlotEntryInput,
} from "@/lib/meals";

export type MenuFormState = { error?: string; ok?: boolean } | undefined;

function refresh() {
  revalidatePath("/today");
  revalidatePath("/menu");
  revalidatePath("/admin");
  revalidatePath("/admin/menus");
}

/** What the editor posts: one entry list per slot per day. */
type WeekPayload = {
  date: string;
  lunch: SlotEntryInput[];
  dinner: SlotEntryInput[];
}[];

function parseEntry(raw: unknown): SlotEntryInput | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const dish = typeof value.dish === "string" ? value.dish : "";
  const id = typeof value.id === "number" ? value.id : null;
  const timing: PrepTiming =
    value.prepTiming === "day_before" ? "day_before" : "same_day";

  return {
    id,
    dish,
    recipeId: typeof value.recipeId === "number" ? value.recipeId : null,
    forWhom: typeof value.forWhom === "string" ? value.forWhom : "",
    notes: typeof value.notes === "string" ? value.notes : "",
    prepTiming: timing,
  };
}

/** Saves a whole week of the menu in one submit. */
export async function saveWeek(
  _state: MenuFormState,
  formData: FormData,
): Promise<MenuFormState> {
  const viewer = await requireAdmin();

  let payload: WeekPayload;
  try {
    const raw = JSON.parse(String(formData.get("payload") ?? "[]"));
    if (!Array.isArray(raw)) throw new Error("not a list");
    payload = raw.map((day: Record<string, unknown>) => ({
      date: String(day.date ?? ""),
      lunch: (Array.isArray(day.lunch) ? day.lunch : [])
        .map(parseEntry)
        .filter((entry): entry is SlotEntryInput => entry !== null),
      dinner: (Array.isArray(day.dinner) ? day.dinner : [])
        .map(parseEntry)
        .filter((entry): entry is SlotEntryInput => entry !== null),
    }));
  } catch {
    return { error: "The menu could not be read. Reload the page and try again." };
  }

  for (const day of payload) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day.date)) {
      return { error: "That week does not look like a set of dates." };
    }
  }

  for (const day of payload) {
    for (const slot of SLOTS) {
      await replaceSlot(viewer.household.id, day.date, slot, day[slot]);
    }
  }

  refresh();
  return { ok: true };
}

export async function copyPreviousWeek(
  fromMonday: string,
  toMonday: string,
): Promise<void> {
  const viewer = await requireAdmin();
  await copyWeek(viewer.household.id, fromMonday, toMonday);
  refresh();
}

/** Ticks the cooking or the day-before prep for one dish. */
export async function toggleMeal(mealId: number, done: boolean): Promise<void> {
  const viewer = await requireViewer();

  const meal = await db.query.meals.findFirst({
    where: and(eq(meals.id, mealId), eq(meals.householdId, viewer.household.id)),
  });
  if (!meal) return;

  await setMealDone(mealId, done, viewer.user.id);
  refresh();
}

export type { MealSlot };
