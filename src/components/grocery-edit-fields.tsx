"use client";

import { useActionState, useEffect } from "react";
import {
  deleteGroceryItem,
  updateGroceryItem,
  type GroceryFormState,
} from "@/app/actions/groceries";
import { buttonClass, cn, inputClass } from "@/components/ui";
import { invalidateData } from "@/lib/client-data";
import { CATEGORIES, CATEGORY_LABEL } from "@/lib/grocery-constants";
import type { GroceryCategory } from "@/db/schema";

export type EditableItem = {
  id: number;
  name: string;
  quantity: string | null;
  note: string | null;
  category: GroceryCategory;
};

/**
 * Inline edit for one item. The admin gets this on every list, locked or not,
 * which is the whole point: a list that has closed is still correctable.
 */
export function GroceryEditFields({
  item,
  onClose,
}: {
  item: EditableItem;
  onClose: () => void;
}) {
  const [state, action, saving] = useActionState<GroceryFormState, FormData>(
    async (previous, formData) => {
      const result = await updateGroceryItem(previous, formData);
      invalidateData();
      return result;
    },
    undefined,
  );

  useEffect(() => {
    if (state?.ok) onClose();
  }, [state, onClose]);

  return (
    <form
      action={action}
      className="flex w-full flex-col gap-2 rounded-lg border border-accent-line bg-accent-soft/30 p-2.5"
    >
      <input type="hidden" name="itemId" value={item.id} />

      <div className="flex flex-wrap gap-2">
        <div className="min-w-40 flex-1">
          <label htmlFor={`edit-name-${item.id}`} className="sr-only">
            Item
          </label>
          <input
            id={`edit-name-${item.id}`}
            name="name"
            defaultValue={item.name}
            required
            autoFocus
            className={cn(inputClass, "font-semibold")}
            autoComplete="off"
          />
        </div>
        <div className="w-28 flex-none">
          <label htmlFor={`edit-qty-${item.id}`} className="sr-only">
            Quantity
          </label>
          <input
            id={`edit-qty-${item.id}`}
            name="quantity"
            defaultValue={item.quantity ?? ""}
            placeholder="2 kg"
            className={inputClass}
            autoComplete="off"
          />
        </div>
        <div className="w-36 flex-none">
          <label htmlFor={`edit-cat-${item.id}`} className="sr-only">
            Aisle
          </label>
          <select
            id={`edit-cat-${item.id}`}
            name="category"
            defaultValue={item.category}
            className={inputClass}
          >
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {CATEGORY_LABEL[category]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <label htmlFor={`edit-note-${item.id}`} className="sr-only">
        Note
      </label>
      <input
        id={`edit-note-${item.id}`}
        name="note"
        defaultValue={item.note ?? ""}
        placeholder="Note, e.g. the big tub, not the small one"
        className={cn(inputClass, "text-xs")}
        autoComplete="off"
      />

      {state?.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={saving}
          className={buttonClass("primary", "sm")}
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className={buttonClass("ghost", "sm")}
        >
          Cancel
        </button>
        <button
          type="button"
          formNoValidate
          onClick={async () => {
            await deleteGroceryItem(item.id);
            invalidateData();
            onClose();
          }}
          className={buttonClass("danger", "sm", "ml-auto")}
        >
          Remove
        </button>
      </div>
    </form>
  );
}
