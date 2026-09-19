"use client";

import { useState } from "react";
import { DayStatusPicker } from "@/components/day-status-picker";
import { cn } from "@/components/ui";
import { STATUS_LABEL, type WorkdayStatus } from "@/lib/workday-constants";

export type WorkdayCell = {
  userId: number;
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

export const DAY_TONE: Record<WorkdayStatus, string> = {
  working: "border-line bg-surface hover:bg-surface-2",
  off: "border-dashed border-line bg-surface-2/60 text-muted hover:bg-surface-2",
  sick: "border-danger-line bg-danger-soft text-danger hover:opacity-90",
  leave: "border-lock-line bg-lock-soft text-lock hover:opacity-90",
};

export const DAY_TONE_RECORDED: Record<WorkdayStatus, string> = {
  working: "border-accent bg-accent-soft text-accent",
  off: "border-dashed border-line-strong bg-surface-2 text-muted",
  sick: "border-danger-line bg-danger-soft text-danger",
  leave: "border-lock-line bg-lock-soft text-lock",
};

/**
 * The week at a glance on the dashboard, and a quick way to record what
 * happened on any of its days.
 */
export function WorkdayStrip({ days }: { days: WorkdayCell[] }) {
  const [openDate, setOpenDate] = useState<string | null>(null);
  const open = days.find((day) => day.date === openDate) ?? null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        {days.map((day) => (
          <button
            key={day.date}
            type="button"
            onClick={() => setOpenDate(day.date === openDate ? null : day.date)}
            aria-expanded={day.date === openDate}
            title={`${day.longDate}: ${STATUS_LABEL[day.status]}${
              day.note ? ` — ${day.note}` : ""
            }. Click to change.`}
            className={cn(
              "flex flex-1 cursor-pointer flex-col items-center gap-1 rounded-xl border px-1 py-2.5 transition-colors",
              day.exception ? DAY_TONE_RECORDED[day.status] : DAY_TONE[day.status],
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
        <DayStatusPicker day={open} onDone={() => setOpenDate(null)} />
      ) : null}
    </div>
  );
}
