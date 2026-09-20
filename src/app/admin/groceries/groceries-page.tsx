"use client";

import { useSearchParams } from "next/navigation";
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
import { PageError, PageSkeleton } from "@/components/skeleton";
import { Card, CardHeader, Chip, Empty, IconLock } from "@/components/ui";
import { useClientData } from "@/lib/client-data";
import type { AdminGroceriesData } from "@/lib/page-data/admin-groceries";

export function AdminGroceries() {
  const searchParams = useSearchParams();
  const requested = searchParams.get("list");
  const url = requested
    ? `/api/admin/groceries?list=${encodeURIComponent(requested)}`
    : "/api/admin/groceries";
  const { data, error, refresh } = useClientData<AdminGroceriesData>(url);

  if (error && !data) return <PageError message={error} onRetry={refresh} />;
  if (!data) return <PageSkeleton variant="admin" />;

  if (!data.selected) {
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

  const { list, order, open, past } = data.selected;

  return (
    <div className="flex flex-col gap-6 px-5 py-6 lg:px-8 lg:py-8">
      <header className="flex flex-col gap-1">
        <p className="font-mono text-xs tracking-widest text-muted uppercase">
          {data.today}
        </p>
        <h1 className="text-3xl leading-tight font-extrabold tracking-tight">
          Groceries
        </h1>
      </header>

      <GroceryListTabs
        tabs={data.tabs}
        currentId={list.id}
        basePath="/admin/groceries"
      />

      {order ? (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-extrabold tracking-tight">
                {order.title}
              </h2>
              <Chip tone={order.isOpen ? "accent" : "lock"}>
                <IconLock size={14} />
                {order.isOpen ? "Unlocked by you" : "Closed"}
              </Chip>
            </div>
            <div className="flex flex-wrap gap-2">
              <UnlockButton
                cycleId={order.cycleId}
                unlocked={order.unlockedByAdmin}
              />
              <CopyListButton text={order.copyText} />
              <FinishOrderingButton
                cycleId={order.cycleId}
                remaining={order.remaining}
              />
            </div>
          </div>

          <OrderProgress items={order.statuses} />

          <Card className="p-4">
            <p className="label mb-2">Forgot something? Add it to this list</p>
            <GroceryAddForm
              cycleId={order.cycleId}
              placeholder="Add to this order, e.g. Coffee"
            />
            <p className="mt-2 text-xs text-muted">
              Closed to {data.employeeName ?? "the household"}, but not to you.
              Use the pencil on any row to correct or remove it.
            </p>
          </Card>

          {order.itemCount === 0 ? (
            <Card>
              <Empty title="Nothing on this list" />
            </Card>
          ) : (
            <>
              <OutcomeGroup title="Carried over" tone="lock" rows={order.carried} />
              {order.groups.map((group) => (
                <OutcomeGroup
                  key={group.category}
                  title={group.label}
                  rows={group.rows}
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
              {open.title}
            </h2>
            {list.closes ? (
              <Chip tone={list.closes.today ? "lock" : "neutral"}>
                {list.closes.label}
              </Chip>
            ) : (
              <Chip>Never closes</Chip>
            )}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
          <div className="flex flex-col gap-3">
            {open.itemCount === 0 ? (
              <Card>
                <Empty
                  title="Nothing on this one yet"
                  hint="Items anyone adds land here until it closes."
                />
              </Card>
            ) : (
              <>
                {open.carried.length > 0 ? (
                  <Card className="border-lock-line">
                    <CardHeader title="Carried over" />
                    <ul>
                      {open.carried.map((row) => (
                        <GroceryItemRow key={row.id} row={row} />
                      ))}
                    </ul>
                  </Card>
                ) : null}

                {open.groups.map((group) => (
                  <Card key={group.category}>
                    <CardHeader title={group.label} />
                    <ul>
                      {group.rows.map((row) => (
                        <GroceryItemRow key={row.id} row={row} />
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
                  cycleId={open.cycleId}
                  remaining={open.remaining}
                />
              </Card>
            ) : null}

            <Card>
              <CardHeader title="Past runs" />
              <ul className="px-5 pt-1 pb-4">
                {past.map((cycle) => (
                  <li
                    key={cycle.id}
                    className="flex items-center justify-between gap-3 border-b border-line py-2 text-sm last:border-b-0"
                  >
                    <span>{cycle.label}</span>
                    <span className="font-mono text-xs text-muted">
                      ordered
                    </span>
                  </li>
                ))}
                {past.length === 0 ? (
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
