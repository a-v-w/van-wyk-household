"use client";

import { useActionState } from "react";
import {
  clearDayRange,
  setDayRange,
  type RangeState,
} from "@/app/actions/household";
import { Field, buttonClass, cn, inputClass } from "@/components/ui";
import { invalidateData } from "@/lib/client-data";
import {
  STATUS_ACTION,
  STATUS_CHOICES,
} from "@/lib/workday-constants";

/**
 * Records a run of days in one go. This is the answer to "she has asked for
 * leave in December": pick the first and last day, choose Leave, save.
 */
export function AttendanceRangeForm({
  userId,
  defaultFrom,
  defaultTo,
}: {
  userId: number;
  defaultFrom: string;
  defaultTo: string;
}) {
  const [state, action, pending] = useActionState<RangeState, FormData>(
    async (previous, formData) => {
      const result = await setDayRange(previous, formData);
      invalidateData();
      return result;
    },
    undefined,
  );
  const [clearState, clearAction, clearing] = useActionState<
    RangeState,
    FormData
  >(async (previous, formData) => {
    const result = await clearDayRange(previous, formData);
    invalidateData();
    return result;
  }, undefined);

  const message = state ?? clearState;

  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="userId" value={userId} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="First day">
            <input
              id="range-from"
              type="date"
              name="from"
              defaultValue={defaultFrom}
              required
              className={inputClass}
            />
          </Field>
          <Field label="Last day" hint="The same day for a single date.">
            <input
              id="range-to"
              type="date"
              name="to"
              defaultValue={defaultTo}
              required
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="Record these days as">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {STATUS_CHOICES.map((status, index) => (
              <label
                key={status}
                className="cursor-pointer"
                title={STATUS_ACTION[status]}
              >
                <input
                  type="radio"
                  name="status"
                  value={status}
                  defaultChecked={status === "leave"}
                  className="peer sr-only"
                />
                <span
                  className={cn(
                    "flex h-10 items-center justify-center rounded-lg border border-line-strong bg-surface px-2 text-center text-[13px] font-bold text-ink-2 transition-colors",
                    "peer-checked:border-accent peer-checked:bg-accent peer-checked:text-[var(--accent-ink)]",
                  )}
                  data-index={index}
                >
                  {STATUS_ACTION[status]}
                </span>
              </label>
            ))}
          </div>
        </Field>

        <Field label="Note" hint="Shown on every day in the run.">
          <input
            id="range-note"
            name="note"
            placeholder="e.g. December holiday"
            className={inputClass}
            autoComplete="off"
          />
        </Field>

        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-surface-2 px-4 py-3">
          <input
            type="checkbox"
            name="onlyWorkdays"
            defaultChecked
            className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
          />
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-bold">Skip the usual days off</span>
            <span className="text-xs text-ink-2">
              A run over two weeks records only the weekdays, not the weekends
              that were never working days anyway.
            </span>
          </span>
        </label>

        {message?.error ? (
          <p
            role="alert"
            className="rounded-lg border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger"
          >
            {message.error}
          </p>
        ) : null}
        {message?.ok ? (
          <p role="status" className="text-sm font-bold text-ok">
            {message.ok}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={pending || clearing}
            className={buttonClass("primary")}
          >
            {pending ? "Recording…" : "Record these days"}
          </button>
          <button
            type="submit"
            formAction={clearAction}
            formNoValidate
            disabled={pending || clearing}
            title="Forget every record in this run"
            className={buttonClass("ghost")}
          >
            {clearing ? "Clearing…" : "Clear the run"}
          </button>
        </div>
      </form>
    </div>
  );
}
