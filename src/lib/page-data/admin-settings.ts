import "server-only";

import type { ListRow } from "@/components/grocery-lists-manager";
import type { PersonRow } from "@/components/people-manager";
import { allHouseholdMembers, type Viewer } from "@/lib/auth";
import { WEEKDAY_NAMES } from "@/lib/dates";
import { currentCycle, householdLists, loadCycleView } from "@/lib/groceries";

/* Everything the settings page shows, already shaped, as JSON. */

export type AdminSettingsData = {
  people: PersonRow[];
  household: {
    name: string;
    timezone: string;
    workingWeekdays: number[];
    groceryLockWeekday: number;
    groceryLockTime: string;
    groceryOrderWeekday: number;
    reminderTime: string;
  };
  lists: ListRow[];
  /** e.g. "Fridays at 18:00, ordered on Monday". */
  lockSummary: string;
  account: { name: string; email: string };
};

export async function loadAdminSettings(
  viewer: Viewer,
): Promise<AdminSettingsData> {
  const { household, user } = viewer;

  // The people and the lists do not depend on each other.
  const [people, lists] = await Promise.all([
    allHouseholdMembers(household.id),
    householdLists(household, true),
  ]);

  // Each list's cycle and its items are looked up side by side.
  const listRows: ListRow[] = await Promise.all(
    lists.map(async (list) => {
      const cycle = await currentCycle(household, list);
      const view = await loadCycleView(list, cycle);
      return {
        id: list.id,
        name: list.name,
        kind: list.kind,
        archived: list.archivedAt !== null,
        openItems: view.items.filter((i) => i.status === "pending").length,
      };
    }),
  );

  const lockSummary = `${WEEKDAY_NAMES[household.groceryLockWeekday - 1]}s at ${household.groceryLockTime.slice(0, 5)}, ordered on ${WEEKDAY_NAMES[household.groceryOrderWeekday - 1]}`;

  return {
    people: people.map((member) => ({
      id: member.id,
      name: member.name,
      email: member.email,
      jobTitle: member.jobTitle,
      role: member.role,
      archived: member.archivedAt !== null,
      isYou: member.id === user.id,
    })),
    household: {
      name: household.name,
      timezone: household.timezone,
      workingWeekdays: household.workingWeekdays,
      groceryLockWeekday: household.groceryLockWeekday,
      groceryLockTime: household.groceryLockTime,
      groceryOrderWeekday: household.groceryOrderWeekday,
      reminderTime: household.reminderTime,
    },
    lists: listRows,
    lockSummary,
    account: { name: user.name, email: user.email },
  };
}
