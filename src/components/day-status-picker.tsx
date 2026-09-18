"use client";

import { useState, useTransition } from "react";
import { clearDayStatus, setDayStatus } from "@/app/actions/household";
import { IconCheck, IconUndo, buttonClass, cn, inputClass } from "@/components/ui";
import {
  STATUS_ACTION,
  STATUS_CHOICES,
  STATUS_LABEL,
  type WorkdayStatus,
} from "@/lib/workday-constants";

export type PickerDay = {
  /** Whose day this is. */
  userId: number;
  date: string;
  longDate: string;
  status: WorkdayStatus;
  note: string | null;
  /** True when a record exists, rather than the usual weekday pattern. */
  exception: boolean;
};

/**
 * The panel that records what happened on one date. Shared by the dashboard
 * week strip and the attendance calendar so both behave identically.
 */
export function DayStatusPicker({
  day,
  onDone,
}: {
  day: PickerDay;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState(day.note ?? "");

  function choose(status: WorkdayStatus) {
    startTransition(async () => {
      await setDayStatus(day.userId, day.date, status, note);
      onDone();
    });
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-accent-line bg-accent-soft/40 p-3",
        pending && "opacity-60",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold">{day.longDate}</span>
        <span className="text-xs text-muted">
          Currently {STATUS_LABEL[day.status].toLowerCase()}
          {day.exception ? ", recorded" : ", from the usual pattern"}.
        </span>
        <button
          type="button"
          onClick={onDone}
          className="ml-auto cursor-pointer text-xs font-bold text-muted hover:text-ink"
        >
          Close
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_CHOICES.map((status) => (
          <button
            key={status}
            type="button"
            disabled={pending}
            onClick={() => choose(status)}
            className={cn(
              buttonClass(day.status === status ? "primary" : "secondary", "sm"),
              "flex-1",
            )}
          >
            {day.status === status ? <IconCheck size={14} /> : null}
            {STATUS_ACTION[status]}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <label htmlFor={`day-note-${day.date}`} className="sr-only">
          Note for this day
        </label>
        <input
          id={`day-note-${day.date}`}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Note, e.g. flu, family holiday, came in for the party"
          className={cn(inputClass, "min-w-48 flex-1")}
          autoComplete="off"
        />
        <button
          type="button"
          disabled={pending}
          onClick={() => choose(day.status)}
          className={buttonClass("secondary", "md", "flex-none")}
        >
          Save note
        </button>
        {day.exception ? (
          <button
            type="button"
            disabled={pending}
            title="Forget this record and follow the usual pattern"
            onClick={() =>
              startTransition(async () => {
                await clearDayStatus(day.userId, day.date);
                onDone();
              })
            }
            className={buttonClass("ghost", "md", "flex-none")}
          >
            <IconUndo size={15} />
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}
