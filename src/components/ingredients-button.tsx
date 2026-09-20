"use client";

import { useState, useTransition } from "react";
import {
  addIngredientsToList,
  removeIngredientsFromList,
} from "@/app/actions/grocery-lists";
import { IconCart, IconCheck, IconUndo, cn } from "@/components/ui";
import { invalidateData } from "@/lib/client-data";

export type IngredientTarget = { id: number; name: string };

/**
 * Sends a dish's recipe to a grocery list. Pressing it twice changes nothing,
 * because the items remember which meal put them there.
 */
export function IngredientsButton({
  mealId,
  dish,
  alreadyAdded,
  lists,
  compact = false,
}: {
  mealId: number;
  dish: string;
  alreadyAdded: boolean;
  lists: IngredientTarget[];
  compact?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);
  // The menu editor keeps its rows in local state, so refreshed props never
  // reach this button. It tracks the answer itself.
  const [added, setAdded] = useState(alreadyAdded);

  function send(listId: number) {
    startTransition(async () => {
      const result = await addIngredientsToList(mealId, listId);
      invalidateData();
      setMessage(result?.error ?? result?.ok ?? null);
      setChoosing(false);
      if (!result?.error) setAdded(true);
    });
  }

  if (added) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border border-accent-line bg-accent-soft px-2.5 py-0.5 font-bold text-accent",
            compact ? "text-[11px]" : "text-xs",
          )}
        >
          <IconCheck size={12} className="stroke-3" />
          On the list
        </span>
        <button
          type="button"
          disabled={pending}
          title={`Take ${dish}'s ingredients back off`}
          onClick={() =>
            startTransition(async () => {
              const result = await removeIngredientsFromList(mealId);
              invalidateData();
              setMessage(result?.error ?? result?.ok ?? null);
              if (!result?.error) setAdded(false);
            })
          }
          className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-bold text-muted hover:text-danger"
        >
          <IconUndo size={12} />
          Undo
        </button>
      </div>
    );
  }

  if (choosing && lists.length > 1) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-semibold text-muted">Onto:</span>
        {lists.map((list) => (
          <button
            key={list.id}
            type="button"
            disabled={pending}
            onClick={() => send(list.id)}
            className="cursor-pointer rounded-full border border-accent-line bg-accent-soft px-2.5 py-0.5 text-[11px] font-bold text-accent"
          >
            {list.name}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setChoosing(false)}
          className="cursor-pointer text-[11px] font-bold text-muted"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending || lists.length === 0}
        onClick={() => (lists.length > 1 ? setChoosing(true) : send(lists[0].id))}
        title={`Put ${dish}'s ingredients on a grocery list`}
        className={cn(
          "inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-line-strong bg-surface font-bold text-ink-2 transition-colors hover:border-accent hover:text-accent",
          compact ? "px-2.5 py-0.5 text-[11px]" : "px-3 py-1 text-xs",
        )}
      >
        <IconCart size={12} />
        {pending ? "Adding…" : "Add ingredients"}
      </button>
      {message ? (
        <span className="text-[11px] text-muted">{message}</span>
      ) : null}
    </div>
  );
}
