import "server-only";

import type { GroceryRowData } from "@/components/grocery-item-row";
import type { GroceryTab } from "@/components/grocery-list-tabs";
import type { GroceryCategory, GroceryList } from "@/db/schema";
import type { Viewer } from "@/lib/auth";
import { formatDate, todayIn, type IsoDate } from "@/lib/dates";
import {
  CATEGORY_LABEL,
  currentCycle,
  currentLockDate,
  cyclesAwaitingOrder,
  groupByCategory,
  householdLists,
  loadCycleView,
  type GroceryItemWithUser,
} from "@/lib/groceries";

/* Everything the household grocery page shows, already shaped. */

export type GroceriesData = {
  tabs: GroceryTab[];
  /** Null when the household has no lists at all. */
  selected: {
    list: { id: number; name: string; kind: GroceryList["kind"] };
    /** "Order on Mon 28 Sep" or "Always open". */
    subtitle: string;
    /** Null for a standing list. The label follows "Closes". */
    closes: { today: boolean; label: string } | null;
    /** Only on the day a weekly list closes. */
    lockBanner: {
      /** The lock instant, as ISO. */
      locksAt: string;
      /** The lock time in the household zone, e.g. "17:00". */
      timeLabel: string;
      orderDate: IsoDate | null;
      itemCount: number;
    } | null;
    /** A closed cycle still to be ordered, when there is one. */
    previousOrder: { listName: string; orderLabel: string } | null;
    isOpen: boolean;
    carried: GroceryRowData[];
    groups: {
      category: GroceryCategory;
      label: string;
      rows: GroceryRowData[];
    }[];
  } | null;
};

export async function loadGroceries(
  viewer: Viewer,
  query: URLSearchParams,
): Promise<GroceriesData> {
  const { household, user } = viewer;
  const today = todayIn(household.timezone);
  const requested = query.get("list");
  const requestedId = requested ? Number(requested) : null;

  const lists = await householdLists(household);

  // The list to show: the one asked for, else the first.
  const list: GroceryList | undefined =
    lists.find((l) => l.id === requestedId) ?? lists[0];

  if (!list) return { tabs: [], selected: null };

  // Every list's current cycle and view in one pass, each list queried once;
  // the selected list's cycle and view come out of the same result.
  const [perList, awaiting] = await Promise.all([
    Promise.all(
      lists.map(async (other) => {
        const cycle = await currentCycle(household, other);
        const view = await loadCycleView(other, cycle);
        return { list: other, cycle, view };
      }),
    ),
    cyclesAwaitingOrder(list),
  ]);

  const current = perList.find((entry) => entry.list.id === list.id);
  if (!current) throw new Error("The selected grocery list has no cycle.");
  const { cycle, view } = current;

  // Counts for the tabs, so a list with something waiting is obvious.
  const tabs: GroceryTab[] = perList.map(({ list: other, view: otherView }) => ({
    id: other.id,
    name: other.name,
    kind: other.kind,
    count: otherView.items.filter((i) => i.status === "pending").length,
  }));

  const live = view.items.filter(
    (i) => i.status === "pending" || i.status === "ordered",
  );
  const carried = live.filter((i) => i.carryCount > 0);
  const fresh = live.filter((i) => i.carryCount === 0);

  const lockDate =
    list.kind === "weekly" ? currentLockDate(household, list) : null;
  const locksToday = lockDate === today;
  const lockTime = (at: Date) =>
    at.toLocaleTimeString("en-ZA", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: household.timezone,
    });

  const toRow = (item: GroceryItemWithUser): GroceryRowData => ({
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    note: item.note,
    addedByName: item.addedByUser?.name ?? null,
    addedByRole: item.addedByUser?.role ?? null,
    category: item.category,
    carryCount: item.carryCount,
    carriedReason:
      item.carryCount > 1
        ? "Out of stock more than once. Worth a substitute."
        : item.carryCount === 1
          ? "Was out of stock on the last order."
          : null,
    canDelete: view.isOpen && item.addedBy === user.id,
  });

  return {
    tabs,
    selected: {
      list: { id: list.id, name: list.name, kind: list.kind },
      subtitle: cycle.orderDate
        ? `Order on ${formatDate(cycle.orderDate)}`
        : "Always open",
      closes: lockDate
        ? {
            today: locksToday,
            label: locksToday
              ? `today ${view.locksAt ? lockTime(view.locksAt) : ""}`
              : formatDate(lockDate),
          }
        : null,
      lockBanner:
        locksToday && view.locksAt
          ? {
              locksAt: view.locksAt.toISOString(),
              timeLabel: lockTime(view.locksAt),
              orderDate: cycle.orderDate,
              itemCount: live.length,
            }
          : null,
      previousOrder:
        awaiting.length > 0 && awaiting[0].id !== cycle.id
          ? {
              listName: list.name.toLowerCase(),
              orderLabel: awaiting[0].orderDate
                ? formatDate(awaiting[0].orderDate)
                : "its order day",
            }
          : null,
      isOpen: view.isOpen,
      carried: carried.map(toRow),
      groups: groupByCategory(fresh).map((group) => ({
        category: group.category,
        label: CATEGORY_LABEL[group.category],
        rows: group.items.map(toRow),
      })),
    },
  };
}
