import type { Metadata } from "next";
import {
  CopyListButton,
  FinishOrderingButton,
  UnlockButton,
} from "@/components/grocery-admin-controls";
import { GroceryAddForm } from "@/components/grocery-add-form";
import { GroceryItemRow } from "@/components/grocery-item-row";
import {
  GroceryOutcomeRow,
  type OutcomeRowData,
} from "@/components/grocery-outcome-row";
import {
  Card,
  CardHeader,
  Chip,
  Empty,
  IconLock,
} from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { formatDate, formatDayDate, shiftDate, todayIn } from "@/lib/dates";
import {
  CATEGORY_LABEL,
  currentCycle,
  currentLockDate,
  cyclesAwaitingOrder,
  groupByCategory,
  itemsAsText,
  loadCycleView,
  orderDateForLock,
  pastCycles,
} from "@/lib/groceries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Groceries" };

export default async function AdminGroceriesPage() {
  const viewer = await requireAdmin();
  const { household } = viewer;
  const today = todayIn(household.timezone);

  const open = await currentCycle(household);
  const openView = await loadCycleView(open);
  const awaiting = await cyclesAwaitingOrder(household);
  const toOrder = awaiting[0] ?? null;
  const orderView = toOrder ? await loadCycleView(toOrder) : null;
  const past = await pastCycles(household, 8);

  const nextOrderDate = orderDateForLock(
    household,
    currentLockDate(household),
  );
  const laterOptions = [0, 7, 14].map((offset) => {
    const date = shiftDate(nextOrderDate, offset);
    return { orderDate: date, label: formatDayDate(date) };
  });

  return (
    <div className="flex flex-col gap-6 px-5 py-6 lg:px-8 lg:py-8">
      <header className="flex flex-col gap-1">
        <p className="font-mono text-xs tracking-widest text-muted uppercase">
          {formatDate(today)}
        </p>
        <h1 className="text-3xl leading-tight font-extrabold tracking-tight">
          Groceries
        </h1>
      </header>

      {orderView && toOrder ? (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-extrabold tracking-tight">
                To order on {formatDate(toOrder.orderDate)}
              </h2>
              <Chip tone={orderView.isOpen ? "accent" : "lock"}>
                <IconLock size={14} />
                {orderView.isOpen
                  ? "Unlocked by you"
                  : `Locked ${formatDayDate(toOrder.locksAt.toISOString().slice(0, 10))}`}
              </Chip>
            </div>
            <div className="flex flex-wrap gap-2">
              <UnlockButton
                cycleId={toOrder.id}
                unlocked={toOrder.unlockedByAdmin}
              />
              <CopyListButton text={itemsAsText(orderView.items)} />
              <FinishOrderingButton
                cycleId={toOrder.id}
                remaining={
                  orderView.items.filter((i) => i.status === "pending").length
                }
              />
            </div>
          </div>

          <OrderProgress
            items={orderView.items.map((i) => i.status)}
          />

          {orderView.items.length === 0 ? (
            <Card>
              <Empty title="Nothing on this list" />
            </Card>
          ) : (
            <>
              <OutcomeGroup
                title="Carried over from last week"
                tone="lock"
                rows={orderView.items
                  .filter((i) => i.carryCount > 0)
                  .map((item) =>
                    toRow(item, nextOrderDate, laterOptions),
                  )}
              />
              {groupByCategory(
                orderView.items.filter((i) => i.carryCount === 0),
              ).map((group) => (
                <OutcomeGroup
                  key={group.category}
                  title={CATEGORY_LABEL[group.category]}
                  rows={group.items.map((item) =>
                    toRow(item, nextOrderDate, laterOptions),
                  )}
                />
              ))}
            </>
          )}
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-extrabold tracking-tight">
              Building for {formatDate(open.orderDate)}
            </h2>
            <Chip tone={currentLockDate(household) === today ? "lock" : "neutral"}>
              Locks {formatDate(currentLockDate(household))} at{" "}
              {household.groceryLockTime.slice(0, 5)}
            </Chip>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
          <div className="flex flex-col gap-3">
            {openView.items.length === 0 ? (
              <Card>
                <Empty
                  title="Nothing on next week's list yet"
                  hint="Items either of you add land here until the list locks."
                />
              </Card>
            ) : (
              <>
                {openView.items.filter((i) => i.carryCount > 0).length > 0 ? (
                  <Card className="border-lock-line">
                    <CardHeader title="Carried over" />
                    <ul>
                      {openView.items
                        .filter((i) => i.carryCount > 0)
                        .map((item) => (
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
                              carriedReason: null,
                              canDelete: true,
                            }}
                          />
                        ))}
                    </ul>
                  </Card>
                ) : null}

                {groupByCategory(
                  openView.items.filter((i) => i.carryCount === 0),
                ).map((group) => (
                  <Card key={group.category}>
                    <CardHeader title={CATEGORY_LABEL[group.category]} />
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
                            canDelete: true,
                          }}
                        />
                      ))}
                    </ul>
                  </Card>
                ))}
              </>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <Card className="p-4">
              <p className="label mb-2">Add an item</p>
              <GroceryAddForm />
            </Card>

            <Card>
              <CardHeader title="Past lists" />
              <ul className="px-5 pt-1 pb-4">
                {past
                  .filter((c) => c.orderedAt)
                  .map((cycle) => (
                    <li
                      key={cycle.id}
                      className="flex items-center justify-between gap-3 border-b border-line py-2 text-sm last:border-b-0"
                    >
                      <span>{formatDate(cycle.orderDate)}</span>
                      <span className="font-mono text-xs text-muted">
                        ordered
                      </span>
                    </li>
                  ))}
                {past.filter((c) => c.orderedAt).length === 0 ? (
                  <li className="py-2 text-sm text-muted">
                    None ordered yet.
                  </li>
                ) : null}
              </ul>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}

function toRow(
  item: Awaited<ReturnType<typeof loadCycleView>>["items"][number],
  nextOrderDate: string,
  laterOptions: { orderDate: string; label: string }[],
): OutcomeRowData {
  return {
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    note: item.note,
    status: item.status,
    addedByName: item.addedByUser?.name ?? null,
    addedByRole: item.addedByUser?.role ?? null,
    carryCount: item.carryCount,
    resolutionNote: item.resolutionNote,
    nextListLabel: formatDate(nextOrderDate),
    laterOptions,
  };
}

function OutcomeGroup({
  title,
  rows,
  tone,
}: {
  title: string;
  rows: OutcomeRowData[];
  tone?: "lock";
}) {
  if (rows.length === 0) return null;

  return (
    <Card className={tone === "lock" ? "border-lock-line" : undefined}>
      <CardHeader
        title={<span className={tone === "lock" ? "text-lock" : ""}>{title}</span>}
      />
      <ul>
        {rows.map((row) => (
          <GroceryOutcomeRow key={row.id} row={row} />
        ))}
      </ul>
    </Card>
  );
}

function OrderProgress({ items }: { items: string[] }) {
  const total = items.length;
  const ordered = items.filter((s) => s === "ordered").length;
  const unavailable = items.filter((s) => s === "unavailable").length;
  const dropped = items.filter((s) => s === "dropped").length;
  const resolved = ordered + unavailable + dropped;
  const percent = total === 0 ? 0 : Math.round((resolved / total) * 100);

  return (
    <Card className="flex flex-wrap items-center gap-4 p-4">
      <span className="font-mono text-xl font-bold tabular">
        {resolved} / {total}
      </span>
      <span className="text-sm text-ink-2">resolved</span>
      <div className="h-2 min-w-32 flex-1 overflow-hidden rounded-full bg-surface-3">
        <div
          className="h-full rounded-full bg-accent transition-[width]"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="flex flex-wrap gap-3 text-sm">
        <span>
          <span className="font-mono font-bold tabular">{ordered}</span> ordered
        </span>
        <span className="text-lock">
          <span className="font-mono font-bold tabular">{unavailable}</span> out
          of stock
        </span>
        <span className="text-muted">
          <span className="font-mono font-bold tabular">{dropped}</span> dropped
        </span>
      </div>
    </Card>
  );
}
