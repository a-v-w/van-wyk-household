"use client";

import { HouseholdForm, OwnAccountForm } from "@/app/admin/settings/settings-forms";
import { GroceryListsManager } from "@/components/grocery-lists-manager";
import { PeopleManager } from "@/components/people-manager";
import { PageError, PageSkeleton } from "@/components/skeleton";
import { Card } from "@/components/ui";
import { useClientData } from "@/lib/client-data";
import type { AdminSettingsData } from "@/lib/page-data/admin-settings";

export function AdminSettings() {
  const { data, error, refresh } = useClientData<AdminSettingsData>(
    "/api/admin/settings",
  );

  if (error && !data) return <PageError message={error} onRetry={refresh} />;
  if (!data) return <PageSkeleton variant="admin" cards={4} />;

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
        <PeopleManager people={data.people} />
      </Card>

      <Card className="p-5 lg:p-6">
        <h2 className="mb-4 text-lg font-extrabold tracking-tight">
          The household
        </h2>
        <HouseholdForm values={data.household} />
      </Card>

      <Card className="p-5 lg:p-6">
        <h2 className="mb-1 text-lg font-extrabold tracking-tight">
          Grocery lists
        </h2>
        <p className="mb-5 text-sm text-ink-2">
          One for the weekly shop, and as many others as the household runs:
          the chemist, the hardware shop, the butcher.
        </p>
        <GroceryListsManager lists={data.lists} lockSummary={data.lockSummary} />
      </Card>

      <Card className="p-5 lg:p-6">
        <h2 className="mb-4 text-lg font-extrabold tracking-tight">
          Your account
        </h2>
        <OwnAccountForm account={data.account} />
      </Card>
    </div>
  );
}
