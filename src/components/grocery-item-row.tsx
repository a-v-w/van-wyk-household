"use client";

import { useTransition } from "react";
import { deleteGroceryItem } from "@/app/actions/groceries";
import { Avatar, Chip, IconTrash, cn } from "@/components/ui";

export type GroceryRowData = {
  id: number;
  name: string;
  quantity: string | null;
  note: string | null;
  addedByName: string | null;
  addedByRole: "admin" | "employee" | null;
  carryCount: number;
  carriedReason: string | null;
  canDelete: boolean;
};

export function GroceryItemRow({ row }: { row: GroceryRowData }) {
  const [pending, startTransition] = useTransition();

  return (
    <li
      className={cn(
        "flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0",
        pending && "opacity-50",
      )}
    >
      {row.addedByName ? (
        <Avatar name={row.addedByName} role={row.addedByRole ?? "employee"} size="sm" />
      ) : (
        <span className="h-6 w-6 flex-none" />
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[15px] leading-snug font-semibold">
          {row.name}
          {row.quantity ? (
            <span className="font-normal text-muted"> · {row.quantity}</span>
          ) : null}
        </span>
        {row.note ? (
          <span className="text-xs text-ink-2">{row.note}</span>
        ) : null}
        {row.carriedReason ? (
          <span className="text-xs text-lock">{row.carriedReason}</span>
        ) : null}
      </div>

      {row.carryCount > 0 ? (
        <Chip tone="lock">
          {row.carryCount === 1 ? "Carried once" : `Carried ${row.carryCount}×`}
        </Chip>
      ) : null}

      {row.canDelete ? (
        <button
          type="button"
          aria-label={`Remove ${row.name}`}
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await deleteGroceryItem(row.id);
            })
          }
          className="flex h-8 w-8 flex-none cursor-pointer items-center justify-center rounded-lg text-muted transition-colors hover:bg-danger-soft hover:text-danger"
        >
          <IconTrash size={16} />
        </button>
      ) : null}
    </li>
  );
}
