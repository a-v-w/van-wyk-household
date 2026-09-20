"use client";

import { useState, useTransition } from "react";
import {
  carryItemOver,
  dropItem,
  setItemOrdered,
} from "@/app/actions/groceries";
import { GroceryEditFields } from "@/components/grocery-edit-fields";
import {
  Avatar,
  Chip,
  IconArrowRight,
  IconCheck,
  IconPencil,
  cn,
} from "@/components/ui";
import type { GroceryCategory } from "@/db/schema";
import { invalidateData } from "@/lib/client-data";

export type OutcomeRowData = {
  id: number;
  name: string;
  quantity: string | null;
  note: string | null;
  category: GroceryCategory;
  status: "pending" | "ordered" | "unavailable" | "dropped";
  addedByName: string | null;
  addedByRole: "admin" | "employee" | null;
  carryCount: number;
  resolutionNote: string | null;
  /** Where an out-of-stock item will go, e.g. "Mon 28 Sep". */
  nextListLabel: string;
  laterOptions: { orderDate: string; label: string }[];
};

/**
 * One line of the Monday order. Every item gets one of three outcomes, and
 * "out of stock" moves it onto a later list rather than losing it.
 */
export function GroceryOutcomeRow({ row }: { row: OutcomeRowData }) {
  const [pending, startTransition] = useTransition();
  const [showLater, setShowLater] = useState(false);
  const [editing, setEditing] = useState(false);

  const resolved = row.status !== "pending";

  // A locked list is still the admin's to correct.
  if (editing) {
    return (
      <li className="border-b border-line px-4 py-3 last:border-b-0">
        <GroceryEditFields
          item={{
            id: row.id,
            name: row.name,
            quantity: row.quantity,
            note: row.note,
            category: row.category,
          }}
          onClose={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li
      className={cn(
        "flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 last:border-b-0 sm:flex-nowrap",
        row.status === "unavailable" && "bg-lock-soft/40",
        row.status === "dropped" && "opacity-60",
        pending && "opacity-50",
      )}
    >
      {row.addedByName ? (
        <Avatar
          name={row.addedByName}
          role={row.addedByRole ?? "employee"}
          size="sm"
        />
      ) : (
        <span className="h-6 w-6 flex-none" />
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className={cn(
            "text-[15px] leading-snug font-bold",
            row.status === "dropped" && "line-through",
          )}
        >
          {row.name}
          {row.quantity ? (
            <span className="font-normal text-muted"> · {row.quantity}</span>
          ) : null}
        </span>
        {row.note ? (
          <span className="text-xs text-ink-2">{row.note}</span>
        ) : null}
        {row.carryCount > 0 ? (
          <span className="text-xs text-lock">
            {row.carryCount === 1
              ? "Carried over from last week."
              : `Carried ${row.carryCount} times. Worth a substitute.`}
          </span>
        ) : null}
        {row.status === "unavailable" ? (
          <span className="text-xs font-semibold text-lock">
            Out of stock. Moved to the list for {row.nextListLabel}.
          </span>
        ) : null}
        {row.status === "dropped" && row.resolutionNote ? (
          <span className="text-xs text-muted">
            Not needed: {row.resolutionNote}
          </span>
        ) : null}
        {showLater && row.status === "pending" ? (
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted">Move it to:</span>
            {row.laterOptions.map((option) => (
              <button
                key={option.orderDate}
                type="button"
                onClick={() =>
                  startTransition(async () => {
                    await carryItemOver(row.id, option.orderDate);
                    invalidateData();
                    setShowLater(false);
                  })
                }
                className="cursor-pointer rounded-full border border-lock-line bg-lock-soft px-2.5 py-0.5 text-xs font-bold text-lock"
              >
                {option.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowLater(false)}
              className="cursor-pointer text-xs font-bold text-muted"
            >
              Cancel
            </button>
          </div>
        ) : null}
      </div>

      {row.carryCount > 0 ? (
        <Chip tone="lock" className="flex-none">
          {row.carryCount === 1 ? "Carried once" : `Carried ${row.carryCount}×`}
        </Chip>
      ) : null}

      <div className="flex h-9 w-full flex-none overflow-hidden rounded-lg border border-line-strong text-xs font-bold sm:w-auto">
        <Outcome
          active={row.status === "ordered"}
          tone="ok"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await setItemOrdered(row.id, row.status !== "ordered");
              invalidateData();
            })
          }
        >
          <IconCheck size={14} className="stroke-3" />
          Ordered
        </Outcome>

        <Outcome
          active={row.status === "unavailable"}
          tone="lock"
          disabled={pending || row.status === "unavailable"}
          onClick={() =>
            startTransition(async () => {
              await carryItemOver(row.id);
              invalidateData();
            })
          }
          onContextMenu={(event) => {
            event.preventDefault();
            setShowLater(true);
          }}
          title="Out of stock: move it onto the next list. Right-click to pick a later one."
        >
          <IconArrowRight size={14} />
          Out of stock
        </Outcome>

        <Outcome
          active={row.status === "dropped"}
          tone="muted"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              if (row.status === "dropped") {
                await setItemOrdered(row.id, false);
              } else {
                await dropItem(row.id);
              }
              invalidateData();
            })
          }
        >
          Not needed
        </Outcome>
      </div>

      <div className="flex flex-none items-center gap-1">
        {resolved ? null : (
          <button
            type="button"
            onClick={() => setShowLater((v) => !v)}
            className="hidden cursor-pointer px-1 text-xs font-bold text-muted hover:text-lock sm:block"
          >
            Later list
          </button>
        )}
        <button
          type="button"
          aria-label={`Edit ${row.name}`}
          title="Edit this item"
          onClick={() => setEditing(true)}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-accent"
        >
          <IconPencil size={16} />
        </button>
      </div>
    </li>
  );
}

function Outcome({
  active,
  tone,
  children,
  ...props
}: React.ComponentProps<"button"> & {
  active: boolean;
  tone: "ok" | "lock" | "muted";
}) {
  const activeClass =
    tone === "ok"
      ? "bg-ok text-white"
      : tone === "lock"
        ? "bg-lock text-white"
        : "bg-muted text-white";

  return (
    <button
      type="button"
      className={cn(
        "flex flex-1 cursor-pointer items-center justify-center gap-1.5 border-r border-line px-3 whitespace-nowrap transition-colors last:border-r-0 disabled:cursor-default",
        active ? activeClass : "bg-surface text-ink-2 hover:bg-surface-2",
      )}
      {...props}
    >
      {children}
    </button>
  );
}
