"use client";

import { useState, useTransition } from "react";
import type { GroceryCategory } from "@/db/schema";
import { deleteGroceryItem } from "@/app/actions/groceries";
import { GroceryEditFields } from "@/components/grocery-edit-fields";
import { Avatar, Chip, IconPencil, IconTrash, cn } from "@/components/ui";
import { invalidateData } from "@/lib/client-data";

export type GroceryRowData = {
  id: number;
  name: string;
  quantity: string | null;
  note: string | null;
  category: GroceryCategory;
  addedByName: string | null;
  addedByRole: "admin" | "employee" | null;
  carryCount: number;
  carriedReason: string | null;
  /** The employee may bin her own items while the list is open. */
  canDelete: boolean;
  /** The admin may rewrite anything, on any list, at any time. */
  canEdit?: boolean;
};

export function GroceryItemRow({ row }: { row: GroceryRowData }) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);

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
        "flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0",
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

      {row.canEdit ? (
        <button
          type="button"
          aria-label={`Edit ${row.name}`}
          onClick={() => setEditing(true)}
          className="flex h-8 w-8 flex-none cursor-pointer items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-accent"
        >
          <IconPencil size={16} />
        </button>
      ) : null}

      {row.canDelete && !row.canEdit ? (
        <button
          type="button"
          aria-label={`Remove ${row.name}`}
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await deleteGroceryItem(row.id);
              invalidateData();
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
