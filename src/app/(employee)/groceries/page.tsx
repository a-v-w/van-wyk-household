import type { Metadata } from "next";
import { GroceryAddForm } from "@/components/grocery-add-form";
import { GroceryItemRow } from "@/components/grocery-item-row";
import { GroceryListTabs } from "@/components/grocery-list-tabs";
import { LockBanner } from "@/components/lock-banner";
import { Card, Chip, Empty, IconLock } from "@/components/ui";
import { requireViewer } from "@/lib/auth";
import { formatDate, todayIn } from "@/lib/dates";
import {
  CATEGORY_LABEL,
  currentCycle,
  currentLockDate,
  cyclesAwaitingOrder,
  groupByCategory,
  householdLists,
  loadCycleView,
  resolveList,
} from "@/lib/groceries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Groceries" };

export default async function GroceriesPage({
  searchParams,
}: {
  searchParams: Promise<{ list?: string }>;
}) {
  const viewer = await requireViewer();
  const { household, user } = viewer;
  const today = todayIn(household.timezone);
  const params = await searchParams;

  const lists = await householdLists(household);
  const list = await resolveList(
    household,
    params.list ? Number(params.list) : null,
  );

  if (!list) {
    return (
      <div className="flex flex-col gap-4 px-4 pt-2 pb-8">
        <h1 className="px-1 text-[28px] leading-tight font-extrabold tracking-tight">
          Groceries
        </h1>
        <Card>
          <Empty title="No lists yet" hint="The household admin makes these." />
        </Card>
      </div>
    );
  }

  const cycle = await currentCycle(household, list);
  const view = await loadCycleView(list, cycle);
  const awaiting = await cyclesAwaitingOrder(list);

  // Counts for the tabs, so a list with something waiting is obvious.
  const counts = new Map<number, number>();
  for (const other of lists) {
    const otherCycle = await currentCycle(household, other);
    const otherView = await loadCycleView(other, otherCycle);
    counts.set(
      other.id,
      otherView.items.filter((i) => i.status === "pending").length,
    );
  }

  const live = view.items.filter(
    (i) => i.status === "pending" || i.status === "ordered",
  );
  const carried = live.filter((i) => i.carryCount > 0);
  const fresh = live.filter((i) => i.carryCount === 0);
  const groups = groupByCategory(fresh);
  const locksToday =
    list.kind === "weekly" && currentLockDate(household, list) === today;

  return (
    <div className="flex flex-col gap-5 px-4 pt-2 pb-8">
      <header className="flex flex-col gap-1 px-1">
        <p className="font-mono text-xs tracking-widest text-muted uppercase">
          {cycle.orderDate
            ? `Order on ${formatDate(cycle.orderDate)}`
            : "Always open"}
        </p>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-[28px] leading-tight font-extrabold tracking-tight">
            {list.name}
          </h1>
          {list.kind === "weekly" ? (
            <Chip tone={locksToday ? "lock" : "neutral"}>
              <IconLock size={14} />
              Closes{" "}
              {locksToday
                ? `today ${view.locksAt?.toLocaleTimeString("en-ZA", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                    timeZone: household.timezone,
                  })}`
                : formatDate(currentLockDate(household, list))}
            </Chip>
          ) : null}
        </div>
      </header>

      <GroceryListTabs
        lists={lists}
        current={list}
        basePath="/groceries"
        counts={counts}
      />

      {locksToday && view.locksAt ? (
        <LockBanner
          listName={list.name}
          locksAt={view.locksAt}
          orderDate={cycle.orderDate}
          itemCount={live.length}
          href={`/groceries?list=${list.id}`}
        />
      ) : null}

      {awaiting.length > 0 && awaiting[0].id !== cycle.id ? (
        <div className="rounded-xl border border-line bg-surface-2 px-4 py-3 text-[13px] text-ink-2">
          The previous {list.name.toLowerCase()} is closed and goes in on{" "}
          <strong className="font-semibold text-ink">
            {awaiting[0].orderDate ? formatDate(awaiting[0].orderDate) : "its order day"}
          </strong>
          . Anything you add now is for the next one.
        </div>
      ) : null}

      {carried.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="label px-1 text-lock">Carried over</h2>
          <Card className="border-lock-line">
            <ul>
              {carried.map((item) => (
                <GroceryItemRow
                  key={item.id}
                  row={{
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
                        : "Was out of stock on the last order.",
                    canDelete: view.isOpen && item.addedBy === user.id,
                  }}
                />
              ))}
            </ul>
          </Card>
        </section>
      ) : null}

      {groups.length === 0 && carried.length === 0 ? (
        <Card>
          <Empty
            title="Nothing on this list yet"
            hint="Add what the house runs out of as you notice it."
          />
        </Card>
      ) : (
        groups.map((group) => (
          <section key={group.category} className="flex flex-col gap-2">
            <h2 className="label px-1">{CATEGORY_LABEL[group.category]}</h2>
            <Card>
              <ul>
                {group.items.map((item) => (
                  <GroceryItemRow
                    key={item.id}
                    row={{
                      id: item.id,
                      name: item.name,
                      quantity: item.quantity,
                      note: item.note,
                      addedByName: item.addedByUser?.name ?? null,
                      addedByRole: item.addedByUser?.role ?? null,
                      category: item.category,
                      carryCount: 0,
                      carriedReason: null,
                      canDelete: view.isOpen && item.addedBy === user.id,
                    }}
                  />
                ))}
              </ul>
            </Card>
          </section>
        ))
      )}

      <div className="sticky bottom-2 mt-2 rounded-xl border border-line bg-surface p-3 shadow-[var(--shadow-md)]">
        <GroceryAddForm
          disabled={!view.isOpen}
          listId={list.id}
          placeholder={`Add to ${list.name.toLowerCase()}`}
        />
        {!view.isOpen ? (
          <p className="mt-2 text-xs text-muted">
            This list is closed. Ask the household admin if something urgent is
            missing.
          </p>
        ) : null}
      </div>
    </div>
  );
}
