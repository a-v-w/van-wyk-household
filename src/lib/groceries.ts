import "server-only";

import { and, asc, desc, eq, isNull, lte } from "drizzle-orm";
import { db } from "@/db";
import {
  groceryCycles,
  groceryItems,
  type GroceryCategory,
  type GroceryCycle,
  type GroceryItem,
  type Household,
  type User,
} from "@/db/schema";
import {
  instantAt,
  isoWeekday,
  nowInZone,
  shiftDate,
  todayIn,
  type IsoDate,
} from "@/lib/dates";
import { CATEGORIES, CATEGORY_LABEL } from "@/lib/grocery-constants";

export type GroceryItemWithUser = GroceryItem & { addedByUser: User | null };

export type CycleView = {
  cycle: GroceryCycle;
  items: GroceryItemWithUser[];
  /** False once the lock time has passed, unless the admin unlocked it. */
  isOpen: boolean;
  locksAt: Date;
};

export { CATEGORIES, CATEGORY_LABEL } from "@/lib/grocery-constants";

/* ------------------------------------------------------------ cycle dates -- */

/** The next date on or after `from` that falls on the given ISO weekday. */
function nextWeekdayOnOrAfter(from: IsoDate, weekday: number): IsoDate {
  const diff = (weekday - isoWeekday(from) + 7) % 7;
  return shiftDate(from, diff);
}

/** The next date strictly after `from` that falls on the given ISO weekday. */
function nextWeekdayAfter(from: IsoDate, weekday: number): IsoDate {
  const diff = (weekday - isoWeekday(from) + 7) % 7 || 7;
  return shiftDate(from, diff);
}

/**
 * The lock date of the cycle that is open right now: the next lock weekday,
 * or the one after it when today's lock time has already passed.
 */
export function currentLockDate(household: Household): IsoDate {
  const today = todayIn(household.timezone);
  const candidate = nextWeekdayOnOrAfter(today, household.groceryLockWeekday);
  const locksAt = instantAt(
    candidate,
    household.groceryLockTime,
    household.timezone,
  );
  if (nowInZone(household.timezone).getTime() >= locksAt.getTime()) {
    return shiftDate(candidate, 7);
  }
  return candidate;
}

/** The order date belonging to a lock date. */
export function orderDateForLock(
  household: Household,
  lockDate: IsoDate,
): IsoDate {
  return nextWeekdayAfter(lockDate, household.groceryOrderWeekday);
}

/* ------------------------------------------------------------ cycle access -- */

/** Finds, or creates, the cycle for one order date. */
export async function ensureCycle(
  household: Household,
  orderDate: IsoDate,
): Promise<GroceryCycle> {
  const existing = await db.query.groceryCycles.findFirst({
    where: and(
      eq(groceryCycles.householdId, household.id),
      eq(groceryCycles.orderDate, orderDate),
    ),
  });
  if (existing) return existing;

  // Walk back from the order date to the lock weekday that precedes it.
  const back = (isoWeekday(orderDate) - household.groceryLockWeekday + 7) % 7 || 7;
  const lockDate = shiftDate(orderDate, -back);

  const [created] = await db
    .insert(groceryCycles)
    .values({
      householdId: household.id,
      orderDate,
      locksAt: instantAt(
        lockDate,
        household.groceryLockTime,
        household.timezone,
      ),
    })
    .onConflictDoNothing({
      target: [groceryCycles.householdId, groceryCycles.orderDate],
    })
    .returning();

  if (created) return created;

  // Another request created it between our read and our insert.
  const raced = await db.query.groceryCycles.findFirst({
    where: and(
      eq(groceryCycles.householdId, household.id),
      eq(groceryCycles.orderDate, orderDate),
    ),
  });
  if (!raced) throw new Error("Could not create the grocery cycle.");
  return raced;
}

/** The cycle people are adding to right now. */
export async function currentCycle(
  household: Household,
): Promise<GroceryCycle> {
  const lockDate = currentLockDate(household);
  return ensureCycle(household, orderDateForLock(household, lockDate));
}

export function isCycleOpen(cycle: GroceryCycle): boolean {
  if (cycle.orderedAt) return false;
  if (cycle.unlockedByAdmin) return true;
  return Date.now() < cycle.locksAt.getTime();
}

export async function loadCycleView(
  cycle: GroceryCycle,
): Promise<CycleView> {
  const items = (await db.query.groceryItems.findMany({
    where: eq(groceryItems.cycleId, cycle.id),
    with: { addedByUser: true },
    orderBy: [desc(groceryItems.carryCount), asc(groceryItems.id)],
  })) as GroceryItemWithUser[];

  return {
    cycle,
    items,
    isOpen: isCycleOpen(cycle),
    locksAt: cycle.locksAt,
  };
}

/** Locked cycles the admin has not finished ordering, oldest first. */
export async function cyclesAwaitingOrder(
  household: Household,
): Promise<GroceryCycle[]> {
  return db.query.groceryCycles.findMany({
    where: and(
      eq(groceryCycles.householdId, household.id),
      isNull(groceryCycles.orderedAt),
      lte(groceryCycles.locksAt, new Date()),
    ),
    orderBy: [asc(groceryCycles.orderDate)],
  });
}

export async function pastCycles(
  household: Household,
  limit = 12,
): Promise<GroceryCycle[]> {
  return db.query.groceryCycles.findMany({
    where: eq(groceryCycles.householdId, household.id),
    orderBy: [desc(groceryCycles.orderDate)],
    limit,
  });
}

/* ------------------------------------------------------------------- items -- */

export async function addItem(
  cycleId: number,
  userId: number,
  input: {
    name: string;
    quantity?: string | null;
    category?: GroceryCategory;
    note?: string | null;
  },
): Promise<void> {
  const name = input.name.trim();
  if (!name) return;
  await db.insert(groceryItems).values({
    cycleId,
    addedBy: userId,
    name,
    quantity: input.quantity?.trim() || null,
    category: input.category ?? "other",
    note: input.note?.trim() || null,
  });
}

export async function updateItem(
  itemId: number,
  input: {
    name?: string;
    quantity?: string | null;
    category?: GroceryCategory;
    note?: string | null;
  },
): Promise<void> {
  const patch: Partial<GroceryItem> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.quantity !== undefined) patch.quantity = input.quantity?.trim() || null;
  if (input.category !== undefined) patch.category = input.category;
  if (input.note !== undefined) patch.note = input.note?.trim() || null;
  if (Object.keys(patch).length === 0) return;
  await db.update(groceryItems).set(patch).where(eq(groceryItems.id, itemId));
}

export async function removeItem(itemId: number): Promise<void> {
  await db.delete(groceryItems).where(eq(groceryItems.id, itemId));
}

export async function loadItem(
  itemId: number,
): Promise<(GroceryItem & { cycle: GroceryCycle }) | undefined> {
  return db.query.groceryItems.findFirst({
    where: eq(groceryItems.id, itemId),
    with: { cycle: true },
  }) as Promise<(GroceryItem & { cycle: GroceryCycle }) | undefined>;
}

/* --------------------------------------------------------------- outcomes -- */

/** Ticks an item as bought, or puts it back to pending. */
export async function markOrdered(
  itemId: number,
  ordered: boolean,
): Promise<void> {
  await db
    .update(groceryItems)
    .set({
      status: ordered ? "ordered" : "pending",
      resolvedAt: ordered ? new Date() : null,
      resolutionNote: null,
    })
    .where(eq(groceryItems.id, itemId));
}

/** Drops an item from the list with a reason the employee can see. */
export async function markDropped(
  itemId: number,
  reason: string | null,
): Promise<void> {
  await db
    .update(groceryItems)
    .set({
      status: "dropped",
      resolvedAt: new Date(),
      resolutionNote: reason?.trim() || null,
    })
    .where(eq(groceryItems.id, itemId));
}

/**
 * Marks an item unavailable and copies it onto a later list, keeping its
 * quantity, note and a count of how many times it has been carried.
 */
export async function carryOver(
  household: Household,
  itemId: number,
  targetOrderDate?: IsoDate,
): Promise<{ targetOrderDate: IsoDate } | null> {
  const item = await loadItem(itemId);
  if (!item) return null;

  const orderDate =
    targetOrderDate ??
    orderDateForLock(household, currentLockDate(household));

  // Never carry an item onto the list it is already on.
  if (orderDate <= item.cycle.orderDate) return null;

  const target = await ensureCycle(household, orderDate);

  await db
    .update(groceryItems)
    .set({ status: "unavailable", resolvedAt: new Date() })
    .where(eq(groceryItems.id, itemId));

  await db.insert(groceryItems).values({
    cycleId: target.id,
    name: item.name,
    quantity: item.quantity,
    category: item.category,
    note: item.note,
    addedBy: item.addedBy,
    status: "pending",
    carriedFromItemId: item.id,
    carryCount: item.carryCount + 1,
  });

  return { targetOrderDate: orderDate };
}

/** Puts every unresolved item to bed and closes the cycle. */
export async function markCycleOrdered(cycleId: number): Promise<void> {
  await db
    .update(groceryItems)
    .set({ status: "ordered", resolvedAt: new Date() })
    .where(
      and(eq(groceryItems.cycleId, cycleId), eq(groceryItems.status, "pending")),
    );

  await db
    .update(groceryCycles)
    .set({ orderedAt: new Date(), unlockedByAdmin: false })
    .where(eq(groceryCycles.id, cycleId));
}

export async function setCycleUnlocked(
  cycleId: number,
  unlocked: boolean,
): Promise<void> {
  await db
    .update(groceryCycles)
    .set({ unlockedByAdmin: unlocked })
    .where(eq(groceryCycles.id, cycleId));
}

/* ----------------------------------------------------------------- export -- */

/** The locked list as plain lines, for pasting into a shop's own app. */
export function itemsAsText(items: GroceryItem[]): string {
  const live = items.filter((i) => i.status === "pending" || i.status === "ordered");
  const byCategory = new Map<GroceryCategory, GroceryItem[]>();
  for (const item of live) {
    const list = byCategory.get(item.category) ?? [];
    list.push(item);
    byCategory.set(item.category, list);
  }

  const lines: string[] = [];
  for (const category of CATEGORIES) {
    const list = byCategory.get(category);
    if (!list?.length) continue;
    lines.push(`${CATEGORY_LABEL[category]}:`);
    for (const item of list) {
      lines.push(`- ${item.name}${item.quantity ? ` (${item.quantity})` : ""}`);
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}

export function groupByCategory(
  items: GroceryItemWithUser[],
): { category: GroceryCategory; items: GroceryItemWithUser[] }[] {
  return CATEGORIES.map((category) => ({
    category,
    items: items.filter((i) => i.category === category),
  })).filter((group) => group.items.length > 0);
}
