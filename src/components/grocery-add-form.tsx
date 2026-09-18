"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  addGroceryItem,
  type GroceryFormState,
} from "@/app/actions/groceries";
import { IconPlus, buttonClass, cn, inputClass } from "@/components/ui";
import { CATEGORIES, CATEGORY_LABEL } from "@/lib/grocery-constants";

/** The add bar at the foot of the list. Stays focused so several items in a
 *  row are quick to type. */
export function GroceryAddForm({ disabled }: { disabled?: boolean }) {
  const [state, action, pending] = useActionState<GroceryFormState, FormData>(
    addGroceryItem,
    undefined,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      nameRef.current?.focus();
    }
  }, [state]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-2">
      {/* The widths live on the wrappers: two width utilities on one input
          fight in the cascade and the loser collapses. */}
      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <input
            ref={nameRef}
            id="grocery-name"
            name="name"
            required
            disabled={disabled}
            placeholder="Add an item, e.g. Milk"
            className={inputClass}
            autoComplete="off"
          />
        </div>
        <div className="w-24 flex-none">
          <input
            id="grocery-quantity"
            name="quantity"
            disabled={disabled}
            placeholder="2 L"
            aria-label="Quantity"
            className={inputClass}
            autoComplete="off"
          />
        </div>
        <button
          type="submit"
          disabled={disabled || pending}
          aria-label="Add to the list"
          className={buttonClass("primary", "md", "w-11 flex-none px-0")}
        >
          <IconPlus size={20} />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="grocery-category" className="label">
          Aisle
        </label>
        <select
          id="grocery-category"
          name="category"
          disabled={disabled}
          defaultValue="other"
          className={cn(inputClass, "h-9 flex-1 py-0")}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
      </div>

      {state?.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
