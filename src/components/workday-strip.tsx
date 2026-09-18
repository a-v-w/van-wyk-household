"use client";

import { useTransition } from "react";
import { toggleWorkday } from "@/app/actions/household";
import { cn } from "@/components/ui";

export type WorkdayCell = {
  date: string;
  weekday: string;
  dayNumber: string;
  working: boolean;
  isToday: boolean;
  /** Working because the admin said so, not because of the default. */
  overridden: boolean;
};

/**
 * The week at a glance. Clicking a day flips it between working and off, which
 * is how an occasional Saturday gets added without touching the defaults.
 */
export function WorkdayStrip({ days }: { days: WorkdayCell[] }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className={cn("flex gap-2", pending && "opacity-60")}>
      {days.map((day) => (
        <button
          key={day.date}
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await toggleWorkday(day.date, day.working);
            })
          }
          aria-pressed={day.working}
          title={
            day.working
              ? `${day.weekday} ${day.dayNumber} is a working day. Click to mark it off.`
              : `${day.weekday} ${day.dayNumber} is off. Click to mark it a working day.`
          }
          className={cn(
            "flex flex-1 cursor-pointer flex-col items-center gap-1 rounded-xl border px-1 py-2.5 transition-colors",
            day.working
              ? day.overridden
                ? "border-accent bg-accent-soft"
                : "border-line bg-surface hover:bg-surface-2"
              : "border-dashed border-line bg-surface-2/60 text-muted hover:bg-surface-2",
            day.isToday && "ring-2 ring-accent/40",
          )}
        >
          <span
            className={cn(
              "label",
              day.working && day.overridden && "text-accent",
            )}
          >
            {day.weekday}
            {day.isToday ? " · today" : day.overridden ? " · added" : ""}
          </span>
          <span className="font-mono text-base font-bold tabular">
            {day.dayNumber}
          </span>
          <span className="text-[10px] font-semibold">
            {day.working ? "Working" : "Off"}
          </span>
        </button>
      ))}
    </div>
  );
}
