import type { Metadata } from "next";
import { HouseholdForm, OwnAccountForm } from "@/app/admin/settings/settings-forms";
import { GroceryListsManager } from "@/components/grocery-lists-manager";
import { PeopleManager } from "@/components/people-manager";
import { Card } from "@/components/ui";
import { allHouseholdMembers, requireAdmin } from "@/lib/auth";
import { WEEKDAY_NAMES } from "@/lib/dates";
import {
  currentCycle,
  householdLists,
  loadCycleView,
} from "@/lib/groceries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const viewer = await requireAdmin();
  const { household, user } = viewer;
  const people = await allHouseholdMembers(household.id);

  const lists = await householdLists(household, true);
  const listRows = await Promise.all(
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


  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 py-6 lg:px-8 lg:py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl leading-tight font-extrabold tracking-tight">
          Settings
        </h1>
        <p className="text-sm text-muted">
          Who is in the household, when they work, and when the grocery list
          locks.
        </p>
      </header>

      <Card className="p-5 lg:p-6">
        <h2 className="mb-1 text-lg font-extrabold tracking-tight">People</h2>
        <p className="mb-5 text-sm text-ink-2">
          Everyone with a login. The name you give someone is the name every
          screen uses, theirs and yours. Each person gets their own tasks and
          their own attendance.
        </p>
        <PeopleManager
          people={people.map((member) => ({
            id: member.id,
            name: member.name,
            email: member.email,
            jobTitle: member.jobTitle,
            role: member.role,
            archived: member.archivedAt !== null,
            isYou: member.id === user.id,
          }))}
        />
      </Card>

      <Card className="p-5 lg:p-6">
        <h2 className="mb-4 text-lg font-extrabold tracking-tight">
          The household
        </h2>
        <HouseholdForm
          values={{
            name: household.name,
            timezone: household.timezone,
            workingWeekdays: household.workingWeekdays,
            groceryLockWeekday: household.groceryLockWeekday,
            groceryLockTime: household.groceryLockTime,
            groceryOrderWeekday: household.groceryOrderWeekday,
            reminderTime: household.reminderTime,
          }}
        />
      </Card>

      <Card className="p-5 lg:p-6">
        <h2 className="mb-1 text-lg font-extrabold tracking-tight">
          Grocery lists
        </h2>
        <p className="mb-5 text-sm text-ink-2">
          One for the weekly shop, and as many others as the household runs:
          the chemist, the hardware shop, the butcher.
        </p>
        <GroceryListsManager lists={listRows} lockSummary={lockSummary} />
      </Card>

      <Card className="p-5 lg:p-6">
        <h2 className="mb-4 text-lg font-extrabold tracking-tight">
          Your account
        </h2>
        <OwnAccountForm account={{ name: user.name, email: user.email }} />
      </Card>
    </div>
  );
}
