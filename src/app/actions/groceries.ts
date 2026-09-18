"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { groceryCycles, type GroceryCategory } from "@/db/schema";
import { requireAdmin, requireViewer } from "@/lib/auth";
import {
  addItem,
  carryOver,
  currentCycle,
  isCycleOpen,
  loadItem,
  markCycleOrdered,
  markDropped,
  markOrdered,
  removeItem,
  resolveList,
  setCycleUnlocked,
  updateItem,
} from "@/lib/groceries";

export type GroceryFormState = { error?: string; ok?: boolean } | undefined;

function refresh() {
  revalidatePath("/groceries");
  revalidatePath("/today");
  revalidatePath("/admin");
  revalidatePath("/admin/groceries");
}

/** One cycle of this household, or undefined. */
async function findCycle(cycleId: number, householdId: number) {
  return db.query.groceryCycles.findFirst({
    where: and(
      eq(groceryCycles.id, cycleId),
      eq(groceryCycles.householdId, householdId),
    ),
  });
}

/* -------------------------------------------------------------- adding on -- */

export async function addGroceryItem(
  _state: GroceryFormState,
  formData: FormData,
): Promise<GroceryFormState> {
  const viewer = await requireViewer();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Type what you need first." };

  const list = await resolveList(
    viewer.household,
    Number(formData.get("listId") ?? 0) || null,
  );
  if (!list) return { error: "There is no grocery list to add to." };

  const cycle = await currentCycle(viewer.household, list);
  if (!isCycleOpen(cycle) && !viewer.isAdmin) {
    return {
      error: `"${list.name}" is locked for this week. Anything new now goes onto the next one.`,
    };
  }

  await addItem(cycle.id, viewer.user.id, {
    name,
    quantity: String(formData.get("quantity") ?? ""),
    category: (String(formData.get("category") ?? "other") ||
      "other") as GroceryCategory,
    note: String(formData.get("note") ?? ""),
  });

  refresh();
  return { ok: true };
}

/** Admin-only: add straight onto a named cycle, from the ordering page. */
export async function addItemToCycle(
  _state: GroceryFormState,
  formData: FormData,
): Promise<GroceryFormState> {
  const viewer = await requireAdmin();
  const cycleId = Number(formData.get("cycleId") ?? 0);
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Type what you need first." };

  const cycle = await findCycle(cycleId, viewer.household.id);
  if (!cycle) return { error: "That list no longer exists." };

  await addItem(cycle.id, viewer.user.id, {
    name,
    quantity: String(formData.get("quantity") ?? ""),
    category: (String(formData.get("category") ?? "other") ||
      "other") as GroceryCategory,
  });

  refresh();
  return { ok: true };
}

/* ---------------------------------------------------------- edit / remove -- */

/**
 * The admin can change any item on any list, locked or not. Everyone else may
 * only touch their own items, and only while the list is still open.
 */
export async function editGroceryItem(
  itemId: number,
  patch: {
    name?: string;
    quantity?: string | null;
    category?: GroceryCategory;
    note?: string | null;
  },
): Promise<void> {
  const viewer = await requireViewer();
  const item = await loadItem(itemId);
  if (!item || item.cycle.householdId !== viewer.household.id) return;

  const mayEdit =
    viewer.isAdmin ||
    (isCycleOpen(item.cycle) && item.addedBy === viewer.user.id);
  if (!mayEdit) return;

  await updateItem(itemId, patch);
  refresh();
}

/** The same edit, driven by a form so it can report back what went wrong. */
export async function updateGroceryItem(
  _state: GroceryFormState,
  formData: FormData,
): Promise<GroceryFormState> {
  const viewer = await requireViewer();
  const itemId = Number(formData.get("itemId") ?? 0);
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "An item needs a name." };

  const item = await loadItem(itemId);
  if (!item || item.cycle.householdId !== viewer.household.id) {
    return { error: "That item is no longer on the list." };
  }

  const mayEdit =
    viewer.isAdmin ||
    (isCycleOpen(item.cycle) && item.addedBy === viewer.user.id);
  if (!mayEdit) {
    return { error: "This list is locked. Ask the household admin to change it." };
  }

  await updateItem(itemId, {
    name,
    quantity: String(formData.get("quantity") ?? ""),
    category: (String(formData.get("category") ?? item.category) ||
      item.category) as GroceryCategory,
    note: String(formData.get("note") ?? ""),
  });

  refresh();
  return { ok: true };
}

export async function deleteGroceryItem(itemId: number): Promise<void> {
  const viewer = await requireViewer();
  const item = await loadItem(itemId);
  if (!item || item.cycle.householdId !== viewer.household.id) return;

  // The employee may only remove her own items, and only while the list is open.
  const mayDelete =
    viewer.isAdmin ||
    (isCycleOpen(item.cycle) && item.addedBy === viewer.user.id);
  if (!mayDelete) return;

  await removeItem(itemId);
  refresh();
}

/* -------------------------------------------------------------- outcomes -- */

export async function setItemOrdered(
  itemId: number,
  ordered: boolean,
): Promise<void> {
  const viewer = await requireAdmin();
  const item = await loadItem(itemId);
  if (!item || item.cycle.householdId !== viewer.household.id) return;
  await markOrdered(itemId, ordered);
  refresh();
}

/**
 * Out of stock: the item is marked unavailable here and reappears on a later
 * list, keeping its quantity, its note and a count of how often it has moved.
 */
export async function carryItemOver(
  itemId: number,
  targetOrderDate?: string,
): Promise<void> {
  const viewer = await requireAdmin();
  const item = await loadItem(itemId);
  if (!item || item.cycle.householdId !== viewer.household.id) return;
  await carryOver(viewer.household, itemId, targetOrderDate);
  refresh();
}

export async function dropItem(itemId: number, reason?: string): Promise<void> {
  const viewer = await requireAdmin();
  const item = await loadItem(itemId);
  if (!item || item.cycle.householdId !== viewer.household.id) return;
  await markDropped(itemId, reason ?? null);
  refresh();
}

/* ---------------------------------------------------------------- cycles -- */

export async function finishOrdering(cycleId: number): Promise<void> {
  const viewer = await requireAdmin();
  const cycle = await findCycle(cycleId, viewer.household.id);
  if (!cycle) return;
  await markCycleOrdered(cycleId);
  refresh();
}

export async function unlockCycle(
  cycleId: number,
  unlocked: boolean,
): Promise<void> {
  const viewer = await requireAdmin();
  const cycle = await findCycle(cycleId, viewer.household.id);
  if (!cycle) return;
  await setCycleUnlocked(cycleId, unlocked);
  refresh();
}
