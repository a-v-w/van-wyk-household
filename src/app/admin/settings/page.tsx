import { and, eq, gte } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { workdayOverrides } from "@/db/schema";
import {
  EmployeeForm,
  HouseholdForm,
  OwnAccountForm,
} from "@/app/admin/settings/settings-forms";
import { Card, CardHeader, Chip } from "@/components/ui";
import { householdEmployee, requireAdmin } from "@/lib/auth";
import { formatDayDate, shiftDate, todayIn } from "@/lib/dates";
import { STATUS_LABEL } from "@/lib/workday-constants";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const viewer = await requireAdmin();
  const { household, user } = viewer;
  const today = todayIn(household.timezone);
  const employee = await householdEmployee(household.id);

  const upcoming = await db.query.workdayOverrides.findMany({
    where: and(
      eq(workdayOverrides.householdId, household.id),
      gte(workdayOverrides.date, shiftDate(today, -7)),
    ),
  });

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
        <h2 className="mb-4 text-lg font-extrabold tracking-tight">
          {employee ? employee.name : "Add the person who works here"}
        </h2>
        <p className="mb-5 text-sm text-ink-2">
          {employee
            ? `Every screen shows ${employee.name.split(/\s+/)[0]}'s name. Change it here and it changes everywhere.`
            : "Once you add them, their name is used throughout the app — no screen says “the nanny”."}
        </p>
        <EmployeeForm
          employee={
            employee
              ? { id: employee.id, name: employee.name, email: employee.email }
              : null
          }
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

      {upcoming.length > 0 ? (
        <Card>
          <CardHeader title="Dates you have changed" />
          <ul className="flex flex-wrap gap-2 px-5 pt-1 pb-5">
            {upcoming
              .slice()
              .sort((a, b) => (a.date < b.date ? -1 : 1))
              .map((override) => (
                <li key={override.id}>
                  <Chip
                    tone={
                      override.status === "sick"
                        ? "danger"
                        : override.status === "leave"
                          ? "lock"
                          : override.status === "working"
                            ? "accent"
                            : "neutral"
                    }
                  >
                    {formatDayDate(override.date)} ·{" "}
                    {STATUS_LABEL[override.status].toLowerCase()}
                    {override.note ? ` · ${override.note}` : ""}
                  </Chip>
                </li>
              ))}
          </ul>
          <p className="px-5 pb-5 text-xs text-muted">
            Change these on the dashboard by clicking a day in the week strip.
          </p>
        </Card>
      ) : null}

      <Card className="p-5 lg:p-6">
        <h2 className="mb-4 text-lg font-extrabold tracking-tight">
          Your account
        </h2>
        <OwnAccountForm account={{ name: user.name, email: user.email }} />
      </Card>
    </div>
  );
}
