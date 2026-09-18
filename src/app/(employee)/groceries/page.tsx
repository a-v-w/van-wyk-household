import type { Metadata } from "next";
import { GroceryAddForm } from "@/components/grocery-add-form";
import { GroceryItemRow } from "@/components/grocery-item-row";
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
  loadCycleView,
} from "@/lib/groceries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Groceries" };

export default async function GroceriesPage() {
  const viewer = await requireViewer();
  const { household, user } = viewer;
  const today = todayIn(household.timezone);

  const cycle = await currentCycle(household);
  const view = await loadCycleView(cycle);
  const awaiting = await cyclesAwaitingOrder(household);

  const live = view.items.filter(
    (i) => i.status === "pending" || i.status === "ordered",
  );
  const carried = live.filter((i) => i.carryCount > 0);
  const fresh = live.filter((i) => i.carryCount === 0);
  const groups = groupByCategory(fresh);
  const locksToday = currentLockDate(household) === today;

  return (
    <div className="flex flex-col gap-5 px-4 pt-2 pb-8">
      <header className="flex flex-col gap-1 px-1">
        <p className="font-mono text-xs tracking-widest text-muted uppercase">
          Order on {formatDate(cycle.orderDate)}
        </p>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-[28px] leading-tight font-extrabold tracking-tight">
            Groceries
          </h1>
          <Chip tone={locksToday ? "lock" : "neutral"}>
            <IconLock size={14} />
            Locks{" "}
            {locksToday
              ? `today ${view.locksAt.toLocaleTimeString("en-ZA", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                  timeZone: household.timezone,
                })}`
              : formatDate(currentLockDate(household))}
          </Chip>
        </div>
      </header>

      {locksToday ? (
        <LockBanner
          locksAt={view.locksAt}
          orderDate={cycle.orderDate}
          itemCount={live.length}
          href="/groceries"
        />
      ) : null}

      {awaiting.length > 0 ? (
        <div className="rounded-xl border border-line bg-surface-2 px-4 py-3 text-[13px] text-ink-2">
          Last week&apos;s list is locked and goes in on{" "}
          <strong className="font-semibold text-ink">
            {formatDate(awaiting[0].orderDate)}
          </strong>
          . Anything you add now is for {formatDate(cycle.orderDate)}.
        </div>
      ) : null}

      {carried.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="label px-1 text-lock">Carried over from last week</h2>
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
                    carryCount: item.carryCount,
                    carriedReason:
                      item.carryCount > 1
                        ? "Out of stock more than once. Worth a substitute."
                        : "Was out of stock on the last order.",
                    canDelete:
                      view.isOpen && item.addedBy === user.id,
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
            title="Nothing on the list yet"
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
        <GroceryAddForm disabled={!view.isOpen} />
        {!view.isOpen ? (
          <p className="mt-2 text-xs text-muted">
            This list is locked. Ask the household admin if something urgent is
            missing.
          </p>
        ) : null}
      </div>
    </div>
  );
}
