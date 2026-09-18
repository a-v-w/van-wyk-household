"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { groceryLists, meals, type GroceryListKind } from "@/db/schema";
import { requireAdmin, requireViewer } from "@/lib/auth";
import { findList, householdLists, isCycleOpen, currentCycle } from "@/lib/groceries";
import { addMealIngredients, removeMealIngredients } from "@/lib/shopping";

export type ListState = { error?: string; ok?: string; id?: number } | undefined;

function refresh() {
  revalidatePath("/groceries");
  revalidatePath("/menu");
  revalidatePath("/today");
  revalidatePath("/admin");
  revalidatePath("/admin/groceries");
  revalidatePath("/admin/menus");
  revalidatePath("/admin/settings");
}

/* ------------------------------------------------------------------ lists -- */

/**
 * Adds or renames a list. A weekly list follows the household's lock-and-order
 * rhythm; a standing one never closes, which suits a running "when you pass a
 * hardware shop" list.
 */
export async function saveGroceryList(
  _state: ListState,
  formData: FormData,
): Promise<ListState> {
  const viewer = await requireAdmin();

  const id = Number(formData.get("id") ?? 0);
  const name = String(formData.get("name") ?? "").trim();
  const kind: GroceryListKind =
    String(formData.get("kind") ?? "weekly") === "standing"
      ? "standing"
      : "weekly";

  if (!name) return { error: "Give the list a name." };

  if (id) {
    const existing = await findList(viewer.household.id, id);
    if (!existing) return { error: "That list no longer exists." };

    await db
      .update(groceryLists)
      .set({ name, kind })
      .where(eq(groceryLists.id, id));
    refresh();
    return { ok: "Saved.", id };
  }

  const lists = await householdLists(viewer.household, true);
  const [created] = await db
    .insert(groceryLists)
    .values({
      householdId: viewer.household.id,
      name,
      kind,
      sortOrder: lists.length,
    })
    .returning({ id: groceryLists.id });

  refresh();
  return { ok: `"${name}" is ready.`, id: created?.id };
}

/** Puts a list away. Its history stays; nothing new can be added to it. */
export async function archiveGroceryList(listId: number): Promise<void> {
  const viewer = await requireAdmin();

  const lists = await householdLists(viewer.household);
  if (lists.length <= 1) return; // never leave the household with none

  const existing = await findList(viewer.household.id, listId);
  if (!existing) return;

  await db
    .update(groceryLists)
    .set({ archivedAt: new Date() })
    .where(eq(groceryLists.id, listId));
  refresh();
}

export async function restoreGroceryList(listId: number): Promise<void> {
  const viewer = await requireAdmin();
  const existing = await findList(viewer.household.id, listId);
  if (!existing) return;

  await db
    .update(groceryLists)
    .set({ archivedAt: null })
    .where(eq(groceryLists.id, listId));
  refresh();
}

/* ------------------------------------------------- recipes onto the list -- */

export type IngredientsState =
  | { error?: string; ok?: string; mealId?: number }
  | undefined;

/**
 * Copies a dish's recipe onto a grocery list. Anyone in the household can do
 * this, since whoever is cooking knows what the kitchen is short of.
 */
export async function addIngredientsToList(
  mealId: number,
  listId?: number,
): Promise<IngredientsState> {
  const viewer = await requireViewer();

  const meal = await db.query.meals.findFirst({
    where: and(eq(meals.id, mealId), eq(meals.householdId, viewer.household.id)),
    with: { recipe: true },
  });
  if (!meal) return { error: "That meal is no longer on the menu." };
  if (!meal.recipe) {
    return { error: "There is no recipe attached to that dish yet." };
  }

  const lists = await householdLists(viewer.household);
  const list = lists.find((l) => l.id === listId) ?? lists[0];
  if (!list) return { error: "There is no grocery list to add to." };

  // The lock binds everyone but an admin, same as adding an item by hand.
  const cycle = await currentCycle(viewer.household, list);
  if (!isCycleOpen(cycle) && !viewer.isAdmin) {
    return { error: `"${list.name}" is locked for this week.` };
  }

  const result = await addMealIngredients(
    viewer.household,
    list,
    meal,
    viewer.user.id,
  );
  refresh();

  if (result.skipped) {
    return { ok: `Already on a list.`, mealId };
  }
  if (result.added === 0) {
    return { error: "That recipe has no ingredients written down yet." };
  }
  return {
    ok: `${result.added} ${result.added === 1 ? "item" : "items"} added to ${list.name}.`,
    mealId,
  };
}

/** Takes a dish's ingredients back off the list again. */
export async function removeIngredientsFromList(
  mealId: number,
): Promise<IngredientsState> {
  const viewer = await requireViewer();

  const meal = await db.query.meals.findFirst({
    where: and(eq(meals.id, mealId), eq(meals.householdId, viewer.household.id)),
  });
  if (!meal) return { error: "That meal is no longer on the menu." };

  const removed = await removeMealIngredients(mealId);
  refresh();
  return {
    ok: removed === 0 ? "Nothing to take off." : `${removed} removed.`,
    mealId,
  };
}
