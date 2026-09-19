"use client";

import { toggleTask } from "@/app/actions/tasks";
import { toggleMeal } from "@/app/actions/meals";
import { CheckButton } from "@/components/check-button";
import { Chip, cn } from "@/components/ui";

export type TaskRowData = {
  taskId: number;
  date: string;
  title: string;
  notes: string | null;
  done: boolean;
  time: string | null;
  rule: string | null;
  overdue: boolean;
  assigneeName: string | null;
  /** Shown only when the list mixes people. */
  showAssignee: boolean;
  canTick: boolean;
  completedLabel: string | null;
};

export function TaskRow({ row }: { row: TaskRowData }) {
  return (
    <li className="flex items-start gap-3 border-b border-line px-4 py-3.5 last:border-b-0">
      <CheckButton
        done={row.done}
        disabled={!row.canTick}
        label={`${row.done ? "Untick" : "Tick off"} ${row.title}`}
        onToggle={(next) => toggleTask(row.taskId, row.date, next)}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span
          className={cn(
            "text-[15px] leading-snug font-semibold",
            row.done && "text-muted line-through",
          )}
        >
          {row.title}
        </span>
        {row.notes ? (
          <span className="text-[13px] leading-snug text-ink-2">{row.notes}</span>
        ) : null}
        <div className="flex flex-wrap items-center gap-1.5">
          {row.overdue ? <Chip tone="danger">Overdue</Chip> : null}
          {row.time ? (
            <Chip className="tabular font-mono">{row.time}</Chip>
          ) : null}
          {row.rule ? <Chip>{row.rule}</Chip> : null}
          {row.showAssignee && row.assigneeName ? (
            <Chip tone="accent">{row.assigneeName}</Chip>
          ) : null}
          {row.done && row.completedLabel ? (
            <span className="font-mono text-[11px] text-muted">
              {row.completedLabel}
            </span>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export type PrepRowData = {
  mealId: number;
  title: string;
  notes: string | null;
  done: boolean;
  chip: string;
  rolledBackFrom: string | null;
  canTick: boolean;
};

export function PrepRow({ row }: { row: PrepRowData }) {
  return (
    <li className="flex items-start gap-3 border-b border-line px-4 py-3.5 last:border-b-0">
      <CheckButton
        done={row.done}
        disabled={!row.canTick}
        label={`${row.done ? "Untick" : "Tick off"} ${row.title}`}
        onToggle={(next) => toggleMeal(row.mealId, next)}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span
          className={cn(
            "text-[15px] leading-snug font-semibold",
            row.done && "text-muted line-through",
          )}
        >
          {row.title}
        </span>
        {row.notes ? (
          <span className="text-[13px] leading-snug text-ink-2">{row.notes}</span>
        ) : null}
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip tone="accent">{row.chip}</Chip>
          {row.rolledBackFrom ? (
            <Chip tone="lock">Moved from {row.rolledBackFrom}</Chip>
          ) : null}
        </div>
      </div>
    </li>
  );
}
