import "server-only";

import type { GroceryRowData } from "@/components/grocery-item-row";
import type { GroceryTab } from "@/components/grocery-list-tabs";
import type { OutcomeRowData } from "@/components/grocery-outcome-row";
import type { GroceryCategory, GroceryList } from "@/db/schema";
import { firstName, householdEmployee, type Viewer } from "@/lib/auth";
import { formatDate, formatDayDate, shiftDate, todayIn } from "@/lib/dates";
import {
  CATEGORY_LABEL,
  currentCycle,
  currentLockDate,
  cyclesAwaitingOrder,
  groupByCategory,
  householdLists,
  itemsAsText,
  loadCycleView,
  orderDateForLock,
  pastCycles,
  type GroceryItemWithUser,
} from "@/lib/groceries";

/* Everything the admin grocery page shows, already shaped and formatted. */

export type AdminGroceriesData = {
  /** Today, formatted for the header. */
  today: string;
  tabs: GroceryTab[];
  employeeName: string | null;
  /** Null when the household has no lists at all. */
  selected: {
    list: {
      id: number;
      name: string;
      kind: GroceryList["kind"];
      /** Null for a standing list, which never closes. */
      closes: { today: boolean; label: string } | null;
    };
    /** A locked cycle still to be ordered, when there is one. */
    order: {
      cycleId: number;
      title: string;
      isOpen: boolean;
      unlockedByAdmin: boolean;
      copyText: string;
      itemCount: number;
      remaining: number;
      statuses: OutcomeRowData["status"][];
      carried: OutcomeRowData[];
      groups: {
        category: GroceryCategory;
        label: string;
        rows: OutcomeRowData[];
      }[];
    } | null;
    /** The cycle people are adding to right now. */
    open: {
      cycleId: number;
      title: string;
      itemCount: number;
      remaining: number;
      carried: GroceryRowData[];
      groups: {
        category: GroceryCategory;
        label: string;
        rows: GroceryRowData[];
      }[];
    };
    past: { id: number; label: string }[];
  } | null;
};

type Selected = NonNullable<AdminGroceriesData["selected"]>;

function pendingCount(items: GroceryItemWithUser[]): number {
  return items.filter((i) => i.status === "pending").length;
}

export async function loadAdminGroceries(
  viewer: Viewer,
  query: URLSearchParams,
): Promise<AdminGroceriesData> {
  const { household } = viewer;
  const today = todayIn(household.timezone);
  const requested = query.get("list");
  const requestedId = requested ? Number(requested) : null;

  const [lists, employee] = await Promise.all([
    householdLists(household),
    householdEmployee(household.id),
  ]);
  const employeeName = employee ? firstName(employee) : null;

  // The list to show: the one asked for, else the first.
  const list: GroceryList | undefined =
    lists.find((l) => l.id === requestedId) ?? lists[0];

  if (!list) {
    return { today: formatDate(today), tabs: [], employeeName, selected: null };
  }

  // Every list's current cycle and view in one pass, each list queried once;
  // the selected list's cycle and view come out of the same result.
  const [perList, awaiting, pastRows] = await Promise.all([
    Promise.all(
      lists.map(async (other) => {
        const cycle = await currentCycle(household, other);
        const view = await loadCycleView(other, cycle);
        return { list: other, cycle, view };
      }),
    ),
    cyclesAwaitingOrder(list),
    pastCycles(list, 8),
  ]);

  const current = perList.find((entry) => entry.list.id === list.id);
  if (!current) throw new Error("The selected grocery list has no cycle.");
  const { cycle: open, view: openView } = current;

  const toOrder = awaiting.find((c) => c.id !== open.id) ?? null;
  const orderView = toOrder ? await loadCycleView(list, toOrder) : null;

  const tabs: GroceryTab[] = perList.map(({ list: other, view }) => ({
    id: other.id,
    name: other.name,
    kind: other.kind,
    count: pendingCount(view.items),
  }));

  /* ------------------------------------------------------------- dates -- */

  const lockDate =
    list.kind === "weekly" ? currentLockDate(household, list) : null;
  const closes = lockDate
    ? {
        today: lockDate === today,
        label: `Closes ${formatDate(lockDate)} at ${(
          list.lockTime ?? household.groceryLockTime
        ).slice(0, 5)}`,
      }
    : null;

  const nextOrderDate = lockDate
    ? orderDateForLock(household, list, lockDate)
    : null;
  const laterOptions = nextOrderDate
    ? [0, 7, 14].map((offset) => {
        const date = shiftDate(nextOrderDate, offset);
        return { orderDate: date, label: formatDayDate(date) };
      })
    : [];
  const nextListLabel = nextOrderDate
    ? formatDate(nextOrderDate)
    : "the next list";

  /* -------------------------------------------------------------- rows -- */

  const toOutcomeRow = (item: GroceryItemWithUser): OutcomeRowData => ({
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    note: item.note,
    category: item.category,
    status: item.status,
    addedByName: item.addedByUser?.name ?? null,
    addedByRole: item.addedByUser?.role ?? null,
    carryCount: item.carryCount,
    resolutionNote: item.resolutionNote,
    nextListLabel,
    laterOptions,
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
    carriedReason: null,
    canDelete: true,
    canEdit: true,
  });

  const order: Selected["order"] =
    toOrder && orderView
      ? {
          cycleId: toOrder.id,
          title: `${list.name} to order${
            toOrder.orderDate ? ` on ${formatDate(toOrder.orderDate)}` : ""
          }`,
          isOpen: orderView.isOpen,
          unlockedByAdmin: toOrder.unlockedByAdmin,
          copyText: itemsAsText(orderView.items),
          itemCount: orderView.items.length,
          remaining: pendingCount(orderView.items),
          statuses: orderView.items.map((i) => i.status),
          carried: orderView.items
            .filter((i) => i.carryCount > 0)
            .map(toOutcomeRow),
          groups: groupByCategory(
            orderView.items.filter((i) => i.carryCount === 0),
          ).map((group) => ({
            category: group.category,
            label: CATEGORY_LABEL[group.category],
            rows: group.items.map(toOutcomeRow),
          })),
        }
      : null;

  const openSection: Selected["open"] = {
    cycleId: open.id,
    title: open.orderDate
      ? `Building for ${formatDate(open.orderDate)}`
      : `${list.name}, always open`,
    itemCount: openView.items.length,
    remaining: pendingCount(openView.items),
    carried: openView.items.filter((i) => i.carryCount > 0).map(toRow),
    groups: groupByCategory(
      openView.items.filter((i) => i.carryCount === 0),
    ).map((group) => ({
      category: group.category,
      label: CATEGORY_LABEL[group.category],
      rows: group.items.map(toRow),
    })),
  };

  const past = pastRows
    .filter((c) => c.orderedAt)
    .map((c) => ({
      id: c.id,
      label: c.orderDate
        ? formatDate(c.orderDate)
        : c.orderedAt
          ? formatDate(c.orderedAt.toISOString().slice(0, 10))
          : "—",
    }));

  return {
    today: formatDate(today),
    tabs,
    employeeName,
    selected: {
      list: { id: list.id, name: list.name, kind: list.kind, closes },
      order,
      open: openSection,
      past,
    },
  };
}
