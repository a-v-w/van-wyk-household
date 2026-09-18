import type { WorkdayStatus } from "@/db/schema";

/**
 * Plain values, safe to import from client components. The parts that read the
 * database live in `@/lib/workdays`, which is server-only.
 */
export const STATUS_LABEL: Record<WorkdayStatus, string> = {
  working: "Worked",
  sick: "Sick",
  leave: "Leave",
  off: "Off",
};

/** The longer wording used on buttons, where there is room to be clear. */
export const STATUS_ACTION: Record<WorkdayStatus, string> = {
  working: "Worked this day",
  off: "Not working",
  sick: "Off sick",
  leave: "On leave",
};

export const STATUS_CHOICES: WorkdayStatus[] = [
  "working",
  "off",
  "sick",
  "leave",
];

export type { WorkdayStatus };
