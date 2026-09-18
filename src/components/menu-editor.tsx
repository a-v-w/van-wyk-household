"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import {
  copyPreviousWeek,
  saveWeek,
  type MenuFormState,
} from "@/app/actions/meals";
import { Chip, buttonClass, cn, inputClass } from "@/components/ui";

export type MenuCell = {
  dish: string;
  notes: string;
  timing: "same_day" | "day_before";
  /** Where the day-before prep will actually land. */
  prepLabel: string | null;
  rolledBack: boolean;
};

export type MenuDay = {
  date: string;
  weekday: string;
  dayNumber: string;
  working: boolean;
  isToday: boolean;
  lunch: MenuCell;
  dinner: MenuCell;
};

export function MenuEditor({
  days,
  previousMonday,
  monday,
}: {
  days: MenuDay[];
  previousMonday: string;
  monday: string;
}) {
  const router = useRouter();
  const [state, action, saving] = useActionState<MenuFormState, FormData>(
    saveWeek,
    undefined,
  );
  const [copying, startCopy] = useTransition();
  // The confirmation is just the last action's result; no timer needed.
  const saved = Boolean(state?.ok) && !saving;

  return (
    <form action={action} className="flex flex-col gap-4">
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
              "flex flex-col gap-3 rounded-xl border p-3",
              day.working
                ? "border-line bg-surface"
                : "border-dashed border-line bg-surface-2/50",
              day.isToday && "ring-2 ring-accent/40",
            )}
          >
            <input type="hidden" name="date" value={day.date} />

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

            {(["lunch", "dinner"] as const).map((slot) => {
              const cell = day[slot];
              return (
                <div key={slot} className="flex flex-col gap-1.5">
                  <label
                    htmlFor={`dish-${day.date}-${slot}`}
                    className="label"
                  >
                    {slot}
                  </label>
                  <input
                    id={`dish-${day.date}-${slot}`}
                    name={`dish:${day.date}:${slot}`}
                    defaultValue={cell.dish}
                    placeholder="Dish"
                    className={cn(inputClass, "font-semibold")}
                    autoComplete="off"
                  />
                  <input
                    id={`notes-${day.date}-${slot}`}
                    name={`notes:${day.date}:${slot}`}
                    defaultValue={cell.notes}
                    placeholder="Notes"
                    aria-label={`Notes for ${slot} on ${day.weekday}`}
                    className={cn(inputClass, "text-xs")}
                    autoComplete="off"
                  />
                  <TimingToggle
                    name={`timing:${day.date}:${slot}`}
                    defaultValue={cell.timing}
                    prepLabel={cell.prepLabel}
                    rolledBack={cell.rolledBack}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </form>
  );
}

function TimingToggle({
  name,
  defaultValue,
  prepLabel,
  rolledBack,
}: {
  name: string;
  defaultValue: "same_day" | "day_before";
  prepLabel: string | null;
  rolledBack: boolean;
}) {
  const [value, setValue] = useState(defaultValue);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex overflow-hidden rounded-lg border border-line-strong text-[11px] font-bold">
        {(
          [
            ["same_day", "On the day"],
            ["day_before", "Day before"],
          ] as const
        ).map(([option, label]) => (
          <label
            key={option}
            className={cn(
              "flex-1 cursor-pointer py-1.5 text-center transition-colors",
              value === option
                ? "bg-accent text-accent-ink"
                : "bg-surface text-muted hover:bg-surface-2",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option}
              checked={value === option}
              onChange={() => setValue(option)}
              className="sr-only"
            />
            {label}
          </label>
        ))}
      </div>
      {value === "day_before" && prepLabel ? (
        <span
          className={cn(
            "text-[11px] font-semibold",
            rolledBack ? "text-lock" : "text-muted",
          )}
        >
          Prep lands on {prepLabel}
          {rolledBack ? ", the last working day before it" : ""}
        </span>
      ) : null}
    </div>
  );
}
