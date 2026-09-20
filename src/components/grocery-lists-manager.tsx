"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import {
  archiveGroceryList,
  restoreGroceryList,
  saveGroceryList,
  type ListState,
} from "@/app/actions/grocery-lists";
import {
  Chip,
  Field,
  IconPencil,
  IconPlus,
  IconUndo,
  buttonClass,
  cn,
  inputClass,
} from "@/components/ui";
import { invalidateData } from "@/lib/client-data";

export type ListRow = {
  id: number;
  name: string;
  kind: "weekly" | "standing";
  archived: boolean;
  /** How many things are waiting on it right now. */
  openItems: number;
};

/** The household's grocery lists: the weekly shop, the chemist, the hardware run. */
export function GroceryListsManager({
  lists,
  lockSummary,
}: {
  lists: ListRow[];
  /** e.g. "Fridays at 18:00, ordered on Monday". */
  lockSummary: string;
}) {
  const [editing, setEditing] = useState<number | "new" | null>(null);

  const live = lists.filter((l) => !l.archived);
  const gone = lists.filter((l) => l.archived);

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-2">
        {live.map((list) => (
          <li key={list.id}>
            {editing === list.id ? (
              <ListForm
                list={list}
                lockSummary={lockSummary}
                onClose={() => setEditing(null)}
              />
            ) : (
              <ListLine
                list={list}
                lockSummary={lockSummary}
                onEdit={() => setEditing(list.id)}
                canArchive={live.length > 1}
              />
            )}
          </li>
        ))}
      </ul>

      {editing === "new" ? (
        <ListForm
          list={null}
          lockSummary={lockSummary}
          onClose={() => setEditing(null)}
        />
      ) : (
        <div>
          <button
            type="button"
            onClick={() => setEditing("new")}
            className={buttonClass("primary")}
          >
            <IconPlus size={16} />
            Add a list
          </button>
        </div>
      )}

      {gone.length > 0 ? (
        <div className="flex flex-col gap-2 border-t border-line pt-4">
          <span className="label">Put away</span>
          <ul className="flex flex-col gap-2">
            {gone.map((list) => (
              <li key={list.id}>
                <ListLine
                  list={list}
                  lockSummary={lockSummary}
                  onEdit={() => setEditing(list.id)}
                  canArchive={false}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function ListLine({
  list,
  lockSummary,
  onEdit,
  canArchive,
}: {
  list: ListRow;
  lockSummary: string;
  onEdit: () => void;
  canArchive: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2.5",
        list.archived && "opacity-60",
        pending && "opacity-50",
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-2 text-sm font-bold">
          {list.name}
          {list.openItems > 0 ? (
            <Chip tone="accent">{list.openItems} waiting</Chip>
          ) : null}
        </span>
        <span className="text-xs text-muted">
          {list.kind === "weekly" ? lockSummary : "Always open, never closes"}
        </span>
      </div>

      <button
        type="button"
        onClick={onEdit}
        className={buttonClass("secondary", "sm")}
      >
        <IconPencil size={14} />
        Edit
      </button>

      {list.archived ? (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await restoreGroceryList(list.id);
              invalidateData();
            })
          }
          className={buttonClass("secondary", "sm")}
        >
          <IconUndo size={14} />
          Bring back
        </button>
      ) : canArchive ? (
        <button
          type="button"
          disabled={pending}
          title="Keep its history, stop anything new going on it"
          onClick={() =>
            startTransition(async () => {
              await archiveGroceryList(list.id);
              invalidateData();
            })
          }
          className={buttonClass("danger", "sm")}
        >
          Put away
        </button>
      ) : null}
    </div>
  );
}

function ListForm({
  list,
  lockSummary,
  onClose,
}: {
  list: ListRow | null;
  lockSummary: string;
  onClose: () => void;
}) {
  const [state, action, saving] = useActionState<ListState, FormData>(
    async (previous, formData) => {
      const result = await saveGroceryList(previous, formData);
      invalidateData();
      return result;
    },
    undefined,
  );
  const [kind, setKind] = useState(list?.kind ?? "weekly");

  useEffect(() => {
    if (state?.ok) onClose();
  }, [state, onClose]);

  return (
    <form
      action={action}
      className="flex flex-col gap-4 rounded-lg border border-accent-line bg-accent-soft/30 p-4"
    >
      {list ? <input type="hidden" name="id" value={list.id} /> : null}

      <Field label="Name">
        <input
          id={`list-name-${list?.id ?? "new"}`}
          name="name"
          defaultValue={list?.name ?? ""}
          required
          autoFocus
          placeholder="e.g. Chemist, Hardware, Butcher"
          className={inputClass}
        />
      </Field>

      <Field label="How it works">
        <div className="flex flex-col gap-2 sm:flex-row">
          {(
            [
              ["weekly", "On the weekly rhythm", lockSummary],
              [
                "standing",
                "Always open",
                "Never closes. Close it by hand when you have been.",
              ],
            ] as const
          ).map(([value, title, hint]) => (
            <label
              key={value}
              className={cn(
                "flex flex-1 cursor-pointer flex-col gap-0.5 rounded-lg border px-3 py-2.5 transition-colors",
                kind === value
                  ? "border-accent bg-accent-soft"
                  : "border-line-strong bg-surface hover:bg-surface-2",
              )}
            >
              <input
                type="radio"
                name="kind"
                value={value}
                checked={kind === value}
                onChange={() => setKind(value)}
                className="sr-only"
              />
              <span
                className={cn(
                  "text-sm font-bold",
                  kind === value ? "text-accent" : "text-ink",
                )}
              >
                {title}
              </span>
              <span className="text-xs text-ink-2">{hint}</span>
            </label>
          ))}
        </div>
      </Field>

      {state?.error ? (
        <p
          role="alert"
          className="rounded-lg border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger"
        >
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={saving}
          className={buttonClass("primary")}
        >
          {saving ? "Saving…" : list ? "Save" : "Add the list"}
        </button>
        <button type="button" onClick={onClose} className={buttonClass("ghost")}>
          Cancel
        </button>
      </div>
    </form>
  );
}
