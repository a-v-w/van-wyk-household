"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { meals, type MealSlot, type PrepTiming } from "@/db/schema";
import { requireAdmin, requireViewer } from "@/lib/auth";
import { copyWeek, setMeal, setMealDone } from "@/lib/meals";

export type MenuFormState = { error?: string; ok?: boolean } | undefined;

function refresh() {
  revalidatePath("/today");
  revalidatePath("/menu");
  revalidatePath("/admin");
  revalidatePath("/admin/menus");
}

/** Saves a whole week of the menu in one submit. */
export async function saveWeek(
  _state: MenuFormState,
  formData: FormData,
): Promise<MenuFormState> {
  const viewer = await requireAdmin();
  const dates = formData.getAll("date").map(String);

  for (const date of dates) {
    for (const slot of ["lunch", "dinner"] as MealSlot[]) {
      const dish = String(formData.get(`dish:${date}:${slot}`) ?? "");
      const notes = String(formData.get(`notes:${date}:${slot}`) ?? "");
      const timing = String(
        formData.get(`timing:${date}:${slot}`) ?? "same_day",
      ) as PrepTiming;

      await setMeal(
        viewer.household.id,
        date,
        slot,
        dish,
        notes,
        timing === "day_before" ? "day_before" : "same_day",
      );
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

/** Ticks the cooking or the day-before prep for one meal. */
export async function toggleMeal(
  mealId: number,
  done: boolean,
): Promise<void> {
  const viewer = await requireViewer();

  const meal = await db.query.meals.findFirst({
    where: and(eq(meals.id, mealId), eq(meals.householdId, viewer.household.id)),
  });
  if (!meal) return;

  await setMealDone(mealId, done, viewer.user.id);
  refresh();
}
