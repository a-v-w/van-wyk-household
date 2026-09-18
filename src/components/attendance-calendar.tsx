"use client";

import { useState } from "react";
import { DayStatusPicker } from "@/components/day-status-picker";
import { cn } from "@/components/ui";
import {
  DAY_TONE,
  DAY_TONE_RECORDED,
} from "@/components/workday-strip";
import { STATUS_LABEL, type WorkdayStatus } from "@/lib/workday-constants";

export type CalendarDay = {
  userId: number;
  date: string;
  dayNumber: string;
  longDate: string;
  status: WorkdayStatus;
  note: string | null;
  isToday: boolean;
  /** False for the days either side that pad the first and last weeks. */
  inMonth: boolean;
  exception: boolean;
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** A month of days, each one clickable to record what happened. */
export function AttendanceCalendar({ weeks }: { weeks: CalendarDay[][] }) {
  const [openDate, setOpenDate] = useState<string | null>(null);

  const open =
    weeks.flat().find((day) => day.date === openDate && day.inMonth) ?? null;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((name) => (
          <div key={name} className="label pb-1 text-center">
            {name}
          </div>
        ))}

        {weeks.flat().map((day) => {
          if (!day.inMonth) {
            return (
              <div
                key={day.date}
                aria-hidden="true"
                className="min-h-16 rounded-lg border border-transparent"
              />
            );
          }

          return (
            <button
              key={day.date}
              type="button"
              onClick={() =>
                setOpenDate(day.date === openDate ? null : day.date)
              }
              aria-expanded={day.date === openDate}
              title={`${day.longDate}: ${STATUS_LABEL[day.status]}${
                day.note ? ` — ${day.note}` : ""
              }`}
              className={cn(
                "flex min-h-16 cursor-pointer flex-col items-start gap-0.5 rounded-lg border px-2 py-1.5 text-left transition-colors",
                day.exception
                  ? DAY_TONE_RECORDED[day.status]
                  : DAY_TONE[day.status],
                day.isToday && "ring-2 ring-accent/40",
                day.date === openDate && "ring-2 ring-accent",
              )}
            >
              <span className="font-mono text-sm font-bold tabular">
                {day.dayNumber}
              </span>
              <span className="text-[10px] leading-tight font-semibold">
                {STATUS_LABEL[day.status]}
              </span>
              {day.note ? (
                <span className="line-clamp-2 text-[10px] leading-tight opacity-80">
                  {day.note}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {open ? (
        <DayStatusPicker day={open} onDone={() => setOpenDate(null)} />
      ) : null}
    </div>
  );
}
