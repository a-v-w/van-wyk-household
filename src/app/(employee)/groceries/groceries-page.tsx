"use client";

import { useSearchParams } from "next/navigation";
import { GroceryAddForm } from "@/components/grocery-add-form";
import { GroceryItemRow } from "@/components/grocery-item-row";
import { GroceryListTabs } from "@/components/grocery-list-tabs";
import { LockBanner } from "@/components/lock-banner";
import { PageError, PageSkeleton } from "@/components/skeleton";
import { Card, Chip, Empty, IconLock } from "@/components/ui";
import { useClientData } from "@/lib/client-data";
import type { GroceriesData } from "@/lib/page-data/groceries";

export function Groceries() {
  const searchParams = useSearchParams();
  const requested = searchParams.get("list");
  const url = requested
    ? `/api/groceries?list=${encodeURIComponent(requested)}`
    : "/api/groceries";
  const { data, error, refresh } = useClientData<GroceriesData>(url);

  if (error && !data) return <PageError message={error} onRetry={refresh} />;
  if (!data) return <PageSkeleton variant="employee" />;

  if (!data.selected) {
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

  const {
    list,
    subtitle,
    closes,
    lockBanner,
    previousOrder,
    isOpen,
    carried,
    groups,
  } = data.selected;

  return (
    <div className="flex flex-col gap-5 px-4 pt-2 pb-8">
      <header className="flex flex-col gap-1 px-1">
        <p className="font-mono text-xs tracking-widest text-muted uppercase">
          {subtitle}
        </p>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-[28px] leading-tight font-extrabold tracking-tight">
            {list.name}
          </h1>
          {closes ? (
            <Chip tone={closes.today ? "lock" : "neutral"}>
              <IconLock size={14} />
              Closes {closes.label}
            </Chip>
          ) : null}
        </div>
      </header>

      <GroceryListTabs
        tabs={data.tabs}
        currentId={list.id}
        basePath="/groceries"
      />

      {lockBanner ? (
        <LockBanner
          listName={list.name}
          locksAt={lockBanner.locksAt}
          timeLabel={lockBanner.timeLabel}
          orderDate={lockBanner.orderDate}
          itemCount={lockBanner.itemCount}
          href={`/groceries?list=${list.id}`}
        />
      ) : null}

      {previousOrder ? (
        <div className="rounded-xl border border-line bg-surface-2 px-4 py-3 text-[13px] text-ink-2">
          The previous {previousOrder.listName} is closed and goes in on{" "}
          <strong className="font-semibold text-ink">
            {previousOrder.orderLabel}
          </strong>
          . Anything you add now is for the next one.
        </div>
      ) : null}

      {carried.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="label px-1 text-lock">Carried over</h2>
          <Card className="border-lock-line">
            <ul>
              {carried.map((row) => (
                <GroceryItemRow key={row.id} row={row} />
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
            <h2 className="label px-1">{group.label}</h2>
            <Card>
              <ul>
                {group.rows.map((row) => (
                  <GroceryItemRow key={row.id} row={row} />
                ))}
              </ul>
            </Card>
          </section>
        ))
      )}

      <div className="sticky bottom-2 mt-2 rounded-xl border border-line bg-surface p-3 shadow-[var(--shadow-md)]">
        <GroceryAddForm
          disabled={!isOpen}
          listId={list.id}
          placeholder={`Add to ${list.name.toLowerCase()}`}
        />
        {!isOpen ? (
          <p className="mt-2 text-xs text-muted">
            This list is closed. Ask the household admin if something urgent is
            missing.
          </p>
        ) : null}
      </div>
    </div>
  );
}
