"use client";

import { useState, useTransition } from "react";
import { setDayStatus } from "@/app/actions/household";
import { IconCheck, buttonClass, cn, inputClass } from "@/components/ui";
import {
  STATUS_ACTION,
  STATUS_CHOICES,
  STATUS_LABEL,
  type WorkdayStatus,
} from "@/lib/workday-constants";

export type WorkdayCell = {
  date: string;
  weekday: string;
  dayNumber: string;
  longDate: string;
  status: WorkdayStatus;
  note: string | null;
  isToday: boolean;
  /** True when the status is not what the usual weekday pattern would give. */
  exception: boolean;
};

const TONE: Record<WorkdayStatus, string> = {
  working: "border-line bg-surface hover:bg-surface-2",
  off: "border-dashed border-line bg-surface-2/60 text-muted hover:bg-surface-2",
  sick: "border-danger-line bg-danger-soft text-danger hover:opacity-90",
  leave: "border-lock-line bg-lock-soft text-lock hover:opacity-90",
};

const EXCEPTION_TONE: Record<WorkdayStatus, string> = {
  working: "border-accent bg-accent-soft text-accent",
  off: "border-dashed border-line-strong bg-surface-2 text-muted",
  sick: "border-danger-line bg-danger-soft text-danger",
  leave: "border-lock-line bg-lock-soft text-lock",
};

/**
 * The week at a glance, and where the admin records what happened: an extra
 * Saturday worked, a day off sick, a day of leave.
 */
export function WorkdayStrip({ days }: { days: WorkdayCell[] }) {
  const [pending, startTransition] = useTransition();
  const [openDate, setOpenDate] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const open = days.find((day) => day.date === openDate) ?? null;

  function choose(date: string, status: WorkdayStatus) {
    startTransition(async () => {
      await setDayStatus(date, status, note);
      setOpenDate(null);
      setNote("");
    });
  }

  return (
    <div className={cn("flex flex-col gap-3", pending && "opacity-60")}>
      <div className="flex gap-2">
        {days.map((day) => (
          <button
            key={day.date}
            type="button"
            disabled={pending}
            onClick={() => {
              setOpenDate(day.date === openDate ? null : day.date);
              setNote(day.note ?? "");
            }}
            aria-expanded={day.date === openDate}
            title={`${day.longDate}: ${STATUS_LABEL[day.status]}${
              day.note ? ` — ${day.note}` : ""
            }. Click to change.`}
            className={cn(
              "flex flex-1 cursor-pointer flex-col items-center gap-1 rounded-xl border px-1 py-2.5 transition-colors",
              day.exception ? EXCEPTION_TONE[day.status] : TONE[day.status],
              day.isToday && "ring-2 ring-accent/40",
              day.date === openDate && "ring-2 ring-accent",
            )}
          >
            <span className="label">
              {day.weekday}
              {day.isToday ? " · today" : ""}
            </span>
            <span className="font-mono text-base font-bold tabular">
              {day.dayNumber}
            </span>
            <span className="text-[10px] font-semibold">
              {STATUS_LABEL[day.status]}
            </span>
            {day.note ? (
              <span className="max-w-full truncate text-[10px] opacity-80">
                {day.note}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {open ? (
        <div className="flex flex-col gap-3 rounded-xl border border-accent-line bg-accent-soft/40 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold">{open.longDate}</span>
            <span className="text-xs text-muted">
              Currently {STATUS_LABEL[open.status].toLowerCase()}.
            </span>
            <button
              type="button"
              onClick={() => setOpenDate(null)}
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
                onClick={() => choose(open.date, status)}
                className={cn(
                  buttonClass(
                    open.status === status ? "primary" : "secondary",
                    "sm",
                  ),
                  "flex-1",
                )}
              >
                {open.status === status ? <IconCheck size={14} /> : null}
                {STATUS_ACTION[status]}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <label htmlFor="day-note" className="sr-only">
              Note for this day
            </label>
            <input
              id="day-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Note, e.g. flu, family funeral, came in for the party"
              className={inputClass}
              autoComplete="off"
            />
            <button
              type="button"
              disabled={pending}
              onClick={() => choose(open.date, open.status)}
              className={buttonClass("secondary", "md", "flex-none")}
            >
              Save note
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
