import "server-only";

import { householdMembers, type Viewer } from "@/lib/auth";
import { formatDayDate, shiftDate, todayIn, type IsoDate } from "@/lib/dates";
import { toMissedDays, type MissedDay } from "@/lib/page-data/tasks";
import { loadMissed } from "@/lib/tasks";
import { loadCalendars } from "@/lib/workdays";

/* Everything the household was due to do and did not, so it can be caught up. */

/** How far back the list can look. */
export const MISSED_WINDOWS = [7, 14, 30, 90] as const;
export type MissedWindow = (typeof MISSED_WINDOWS)[number];

export type MissedPerson = {
  id: number;
  name: string;
  role: "admin" | "employee";
  missed: number;
};

export type AdminMissedData = {
  today: IsoDate;
  /** The window in days, and the date it reaches back to. */
  days: MissedWindow;
  sinceLabel: string;
  windows: number[];
  who: number | null;
  /** Missed in the window for the chosen person, or everyone. */
  total: number;
  /** Everyone's counts, so the filter chips can carry a number. */
  people: MissedPerson[];
  groups: MissedDay[];
};

function chosenWindow(query: URLSearchParams): MissedWindow {
  const asked = Number(query.get("days"));
  return (MISSED_WINDOWS as readonly number[]).includes(asked)
    ? (asked as MissedWindow)
    : 14;
}

export async function loadAdminMissed(
  viewer: Viewer,
  query: URLSearchParams,
): Promise<AdminMissedData> {
  const { household } = viewer;
  const today = todayIn(household.timezone);
  const days = chosenWindow(query);
  const since = shiftDate(today, -days);

  const members = await householdMembers(household.id);
  const asked = Number(query.get("who"));
  const who = members.some((m) => m.id === asked) ? asked : null;

  // Everyone's calendar, because a task is only missed on a day its own
  // assignee was working.
  const calendars = await loadCalendars(
    household,
    members.map((m) => m.id),
    since,
    today,
  );
  const missed = await loadMissed({
    householdId: household.id,
    calendars,
    today,
    since,
  });

  const people: MissedPerson[] = members.map((member) => ({
    id: member.id,
    name: member.name,
    role: member.role,
    missed: missed.filter((o) => o.task.assignedTo === member.id).length,
  }));

  const shown = who ? missed.filter((o) => o.task.assignedTo === who) : missed;

  return {
    today,
    days,
    sinceLabel: formatDayDate(since),
    windows: [...MISSED_WINDOWS],
    who,
    total: shown.length,
    people,
    groups: toMissedDays(shown, today, {
      showAssignee: who === null,
      canSkip: true,
    }),
  };
}
