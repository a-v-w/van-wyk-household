"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import {
  copyPreviousWeek,
  saveWeek,
  type MenuFormState,
} from "@/app/actions/meals";
import { IngredientsButton } from "@/components/ingredients-button";
import {
  Chip,
  IconPlus,
  IconTrash,
  buttonClass,
  cn,
  inputClass,
} from "@/components/ui";

type Slot = "lunch" | "dinner";

export type MenuEntry = {
  id: number | null;
  dish: string;
  recipeId: number | null;
  /** True when this dish's ingredients are already on a grocery list. */
  onShoppingList?: boolean;
  forWhom: string;
  notes: string;
  prepTiming: "same_day" | "day_before";
};

export type MenuDay = {
  date: string;
  weekday: string;
  dayNumber: string;
  working: boolean;
  isToday: boolean;
  /** Where day-before prep for this date lands, e.g. "Fri 18". */
  prepLabel: string;
  /** True when that is not simply the day before. */
  prepRolledBack: boolean;
  lunch: MenuEntry[];
  dinner: MenuEntry[];
};

const SLOTS: Slot[] = ["lunch", "dinner"];

function blank(): MenuEntry {
  return {
    id: null,
    dish: "",
    recipeId: null,
    onShoppingList: false,
    forWhom: "",
    notes: "",
    prepTiming: "same_day",
  };
}

export function MenuEditor({
  days: initialDays,
  previousMonday,
  monday,
  recipes,
  groceryLists,
}: {
  days: MenuDay[];
  previousMonday: string;
  monday: string;
  recipes: { id: number; title: string }[];
  groceryLists: { id: number; name: string }[];
}) {
  const router = useRouter();
  const [state, action, saving] = useActionState<MenuFormState, FormData>(
    saveWeek,
    undefined,
  );
  const [copying, startCopy] = useTransition();
  const [days, setDays] = useState(initialDays);

  const saved = Boolean(state?.ok) && !saving;

  function update(
    date: string,
    slot: Slot,
    index: number,
    patch: Partial<MenuEntry>,
  ) {
    setDays((current) =>
      current.map((day) =>
        day.date !== date
          ? day
          : {
              ...day,
              [slot]: day[slot].map((entry, i) =>
                i === index ? { ...entry, ...patch } : entry,
              ),
            },
      ),
    );
  }

  function addEntry(date: string, slot: Slot) {
    setDays((current) =>
      current.map((day) =>
        day.date !== date ? day : { ...day, [slot]: [...day[slot], blank()] },
      ),
    );
  }

  function removeEntry(date: string, slot: Slot, index: number) {
    setDays((current) =>
      current.map((day) =>
        day.date !== date
          ? day
          : { ...day, [slot]: day[slot].filter((_, i) => i !== index) },
      ),
    );
  }

  // Empty dishes are dropped on save, so they never become a blank row.
  const payload = days.map((day) => ({
    date: day.date,
    lunch: day.lunch.filter((e) => e.dish.trim()),
    dinner: day.dinner.filter((e) => e.dish.trim()),
  }));

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="payload" value={JSON.stringify(payload)} />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={copying}
          onClick={() =>
            startCopy(async () => {
              await copyPreviousWeek(previousMonday, monday);
              router.refresh();
            })
          }
          className={buttonClass("secondary", "sm")}
        >
          {copying ? "Copying…" : "Copy last week"}
        </button>
        <span className="text-xs text-muted">
          A slot with nothing in it is left off the menu entirely.
        </span>
        <div className="ml-auto flex items-center gap-3">
          {saved ? (
            <span className="text-sm font-bold text-ok">Menu saved</span>
          ) : null}
          <button
            type="submit"
            disabled={saving}
            className={buttonClass("primary", "sm")}
          >
            {saving ? "Saving…" : "Save menu"}
          </button>
        </div>
      </div>

      {state?.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {days.map((day) => (
          <div
            key={day.date}
            className={cn(
              "flex flex-col gap-4 rounded-xl border p-3",
              day.working
                ? "border-line bg-surface"
                : "border-dashed border-line bg-surface-2/50",
              day.isToday && "ring-2 ring-accent/40",
            )}
          >
            <div className="flex items-center gap-2">
              <span className="label">{day.weekday}</span>
              <span className="font-mono text-sm font-bold tabular">
                {day.dayNumber}
              </span>
              {day.isToday ? (
                <Chip tone="accent" className="ml-auto">
                  Today
                </Chip>
              ) : !day.working ? (
                <span className="ml-auto text-[11px] font-semibold text-muted">
                  Not a working day
                </span>
              ) : null}
            </div>

            {SLOTS.map((slot) => (
              <div key={slot} className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="label">{slot}</span>
                  <button
                    type="button"
                    onClick={() => addEntry(day.date, slot)}
                    className="flex cursor-pointer items-center gap-1 text-[11px] font-bold text-accent"
                  >
                    <IconPlus size={12} />
                    Add
                  </button>
                </div>

                {day[slot].length === 0 ? (
                  <button
                    type="button"
                    onClick={() => addEntry(day.date, slot)}
                    className="cursor-pointer rounded-lg border border-dashed border-line px-3 py-2 text-left text-xs text-muted transition-colors hover:bg-surface-2"
                  >
                    Nothing planned. This slot will not show at all.
                  </button>
                ) : (
                  day[slot].map((entry, index) => (
                    <EntryFields
                      key={entry.id ?? `new-${index}`}
                      entry={entry}
                      slot={slot}
                      date={day.date}
                      index={index}
                      showRemove={true}
                      recipes={recipes}
                      groceryLists={groceryLists}
                      prepLabel={day.prepLabel}
                      prepRolledBack={day.prepRolledBack}
                      onChange={(patch) => update(day.date, slot, index, patch)}
                      onRemove={() => removeEntry(day.date, slot, index)}
                    />
                  ))
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </form>
  );
}

function EntryFields({
  entry,
  slot,
  date,
  index,
  showRemove,
  recipes,
  groceryLists,
  prepLabel,
  prepRolledBack,
  onChange,
  onRemove,
}: {
  entry: MenuEntry;
  slot: Slot;
  date: string;
  index: number;
  showRemove: boolean;
  recipes: { id: number; title: string }[];
  groceryLists: { id: number; name: string }[];
  prepLabel: string;
  prepRolledBack: boolean;
  onChange: (patch: Partial<MenuEntry>) => void;
  onRemove: () => void;
}) {
  const key = `${date}-${slot}-${index}`;

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-line bg-surface-2/40 p-2">
      <div className="flex gap-1.5">
        <div className="min-w-0 flex-1">
          <label htmlFor={`dish-${key}`} className="sr-only">
            Dish
          </label>
          <input
            id={`dish-${key}`}
            value={entry.dish}
            onChange={(event) => onChange({ dish: event.target.value })}
            placeholder="Dish"
            className={cn(inputClass, "font-semibold")}
            autoComplete="off"
          />
        </div>
        {showRemove ? (
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove this dish"
            className="flex h-9 w-8 flex-none cursor-pointer items-center justify-center rounded-lg text-muted transition-colors hover:bg-danger-soft hover:text-danger"
          >
            <IconTrash size={15} />
          </button>
        ) : null}
      </div>

      <label htmlFor={`for-${key}`} className="sr-only">
        Who it is for
      </label>
      <input
        id={`for-${key}`}
        value={entry.forWhom}
        onChange={(event) => onChange({ forWhom: event.target.value })}
        placeholder="For whom (leave empty for everyone)"
        className={cn(inputClass, "text-xs")}
        autoComplete="off"
      />

      <label htmlFor={`notes-${key}`} className="sr-only">
        Notes
      </label>
      <input
        id={`notes-${key}`}
        value={entry.notes}
        onChange={(event) => onChange({ notes: event.target.value })}
        placeholder="Notes"
        className={cn(inputClass, "text-xs")}
        autoComplete="off"
      />

      {/* Attaching a recipe puts the method on the meal itself. */}
      <label htmlFor={`recipe-${key}`} className="sr-only">
        Recipe
      </label>
      <select
        id={`recipe-${key}`}
        value={entry.recipeId ?? ""}
        onChange={(event) =>
          onChange({
            recipeId: event.target.value ? Number(event.target.value) : null,
          })
        }
        className={cn(
          inputClass,
          "text-xs",
          entry.recipeId ? "border-accent text-accent" : "text-muted",
        )}
      >
        <option value="">No recipe attached</option>
        {recipes.map((recipe) => (
          <option key={recipe.id} value={recipe.id}>
            {recipe.title}
          </option>
        ))}
      </select>

      <div className="flex overflow-hidden rounded-lg border border-line-strong text-[11px] font-bold">
        {(
          [
            ["same_day", "On the day"],
            ["day_before", "Day before"],
          ] as const
        ).map(([option, label]) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange({ prepTiming: option })}
            aria-pressed={entry.prepTiming === option}
            className={cn(
              "flex-1 cursor-pointer py-1.5 text-center transition-colors",
              entry.prepTiming === option
                ? "bg-accent text-accent-ink"
                : "bg-surface text-muted hover:bg-surface-2",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {entry.id && entry.recipeId ? (
        <IngredientsButton
          mealId={entry.id}
          dish={entry.dish}
          alreadyAdded={Boolean(entry.onShoppingList)}
          lists={groceryLists}
          compact
        />
      ) : null}

      {entry.prepTiming === "day_before" ? (
        <span
          className={cn(
            "text-[11px] font-semibold",
            prepRolledBack ? "text-lock" : "text-muted",
          )}
        >
          Prep lands on {prepLabel}
          {prepRolledBack ? ", the last working day before it" : ""}
        </span>
      ) : null}
    </div>
  );
}
