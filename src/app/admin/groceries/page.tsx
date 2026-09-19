import type { Metadata } from "next";
import {
  CopyListButton,
  FinishOrderingButton,
  UnlockButton,
} from "@/components/grocery-admin-controls";
import { GroceryAddForm } from "@/components/grocery-add-form";
import { GroceryItemRow } from "@/components/grocery-item-row";
import { GroceryListTabs } from "@/components/grocery-list-tabs";
import {
  GroceryOutcomeRow,
  type OutcomeRowData,
} from "@/components/grocery-outcome-row";
import { Card, CardHeader, Chip, Empty, IconLock } from "@/components/ui";
import { firstName, householdEmployee, requireAdmin } from "@/lib/auth";
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
  resolveList,
} from "@/lib/groceries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Groceries" };

export default async function AdminGroceriesPage({
  searchParams,
}: {
  searchParams: Promise<{ list?: string }>;
}) {
  const viewer = await requireAdmin();
  const { household } = viewer;
  const today = todayIn(household.timezone);
  const params = await searchParams;

  const employee = await householdEmployee(household.id);
  const employeeName = employee ? firstName(employee) : null;

  const lists = await householdLists(household);
  const list = await resolveList(
    household,
    params.list ? Number(params.list) : null,
  );

  if (!list) {
    return (
      <div className="flex flex-col gap-4 px-5 py-6 lg:px-8 lg:py-8">
        <h1 className="text-3xl leading-tight font-extrabold tracking-tight">
          Groceries
        </h1>
        <Card>
          <Empty
            title="No lists yet"
            hint="Make one in Settings and it appears here."
          />
        </Card>
      </div>
    );
  }

  const open = await currentCycle(household, list);
  const openView = await loadCycleView(list, open);
  const awaiting = await cyclesAwaitingOrder(list);
  const toOrder = awaiting.find((c) => c.id !== open.id) ?? null;
  const orderView = toOrder ? await loadCycleView(list, toOrder) : null;
  const past = await pastCycles(list, 8);

  const counts = new Map<number, number>();
  for (const other of lists) {
    const otherCycle = await currentCycle(household, other);
    const otherView = await loadCycleView(other, otherCycle);
    counts.set(
      other.id,
      otherView.items.filter((i) => i.status === "pending").length,
    );
  }

  const nextOrderDate =
    list.kind === "weekly"
      ? orderDateForLock(household, list, currentLockDate(household, list))
      : null;
  const laterOptions = nextOrderDate
    ? [0, 7, 14].map((offset) => {
        const date = shiftDate(nextOrderDate, offset);
        return { orderDate: date, label: formatDayDate(date) };
      })
    : [];

  function toRow(
    item: Awaited<ReturnType<typeof loadCycleView>>["items"][number],
  ): OutcomeRowData {
    return {
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
      nextListLabel: nextOrderDate ? formatDate(nextOrderDate) : "the next list",
      laterOptions,
    };
  }

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

      <GroceryListTabs
        lists={lists}
        current={list}
        basePath="/admin/groceries"
        counts={counts}
      />

      {orderView && toOrder ? (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-extrabold tracking-tight">
                {list.name} to order
                {toOrder.orderDate ? ` on ${formatDate(toOrder.orderDate)}` : ""}
              </h2>
              <Chip tone={orderView.isOpen ? "accent" : "lock"}>
                <IconLock size={14} />
                {orderView.isOpen ? "Unlocked by you" : "Closed"}
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

          <OrderProgress items={orderView.items.map((i) => i.status)} />

          <Card className="p-4">
            <p className="label mb-2">Forgot something? Add it to this list</p>
            <GroceryAddForm
              cycleId={toOrder.id}
              placeholder="Add to this order, e.g. Coffee"
            />
            <p className="mt-2 text-xs text-muted">
              Closed to {employeeName ?? "the household"}, but not to you. Use
              the pencil on any row to correct or remove it.
            </p>
          </Card>

          {orderView.items.length === 0 ? (
            <Card>
              <Empty title="Nothing on this list" />
            </Card>
          ) : (
            <>
              <OutcomeGroup
                title="Carried over"
                tone="lock"
                rows={orderView.items
                  .filter((i) => i.carryCount > 0)
                  .map(toRow)}
              />
              {groupByCategory(
                orderView.items.filter((i) => i.carryCount === 0),
              ).map((group) => (
                <OutcomeGroup
                  key={group.category}
                  title={CATEGORY_LABEL[group.category]}
                  rows={group.items.map(toRow)}
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
              {open.orderDate
                ? `Building for ${formatDate(open.orderDate)}`
                : `${list.name}, always open`}
            </h2>
            {list.kind === "weekly" ? (
              <Chip
                tone={
                  currentLockDate(household, list) === today ? "lock" : "neutral"
                }
              >
                Closes {formatDate(currentLockDate(household, list))} at{" "}
                {(list.lockTime ?? household.groceryLockTime).slice(0, 5)}
              </Chip>
            ) : (
              <Chip>Never closes</Chip>
            )}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
          <div className="flex flex-col gap-3">
            {openView.items.length === 0 ? (
              <Card>
                <Empty
                  title="Nothing on this one yet"
                  hint="Items anyone adds land here until it closes."
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
                              category: item.category,
                              carryCount: item.carryCount,
                              carriedReason: null,
                              canDelete: true,
                              canEdit: true,
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
                            category: item.category,
                            carryCount: 0,
                            carriedReason: null,
                            canDelete: true,
                            canEdit: true,
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
              <GroceryAddForm listId={list.id} />
            </Card>

            {list.kind === "standing" ? (
              <Card className="p-4">
                <p className="label mb-2">Done with this run?</p>
                <p className="mb-3 text-[13px] text-ink-2">
                  Closing it files everything as bought and starts a fresh list.
                </p>
                <FinishOrderingButton
                  cycleId={open.id}
                  remaining={
                    openView.items.filter((i) => i.status === "pending").length
                  }
                />
              </Card>
            ) : null}

            <Card>
              <CardHeader title="Past runs" />
              <ul className="px-5 pt-1 pb-4">
                {past
                  .filter((c) => c.orderedAt)
                  .map((cycle) => (
                    <li
                      key={cycle.id}
                      className="flex items-center justify-between gap-3 border-b border-line py-2 text-sm last:border-b-0"
                    >
                      <span>
                        {cycle.orderDate
                          ? formatDate(cycle.orderDate)
                          : cycle.orderedAt
                            ? formatDate(
                                cycle.orderedAt.toISOString().slice(0, 10),
                              )
                            : "—"}
                      </span>
                      <span className="font-mono text-xs text-muted">
                        ordered
                      </span>
                    </li>
                  ))}
                {past.filter((c) => c.orderedAt).length === 0 ? (
                  <li className="py-2 text-sm text-muted">None ordered yet.</li>
                ) : null}
              </ul>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
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
        title={
          <span className={tone === "lock" ? "text-lock" : ""}>{title}</span>
        }
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
