"use client";

import { useActionState } from "react";
import {
  saveEmployee,
  saveHouseholdSettings,
  saveOwnAccount,
  type SettingsState,
} from "@/app/actions/household";
import { Field, buttonClass, cn, inputClass } from "@/components/ui";
import { WEEKDAY_NAMES, WEEKDAY_SHORT } from "@/lib/dates";

function Message({ state }: { state: SettingsState }) {
  if (state?.error) {
    return (
      <p
        role="alert"
        className="rounded-lg border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger"
      >
        {state.error}
      </p>
    );
  }
  if (state?.ok) {
    return (
      <p role="status" className="text-sm font-bold text-ok">
        {state.ok}
      </p>
    );
  }
  return null;
}

/* --------------------------------------------------------- the household -- */

export function HouseholdForm({
  values,
}: {
  values: {
    name: string;
    timezone: string;
    workingWeekdays: number[];
    groceryLockWeekday: number;
    groceryLockTime: string;
    groceryOrderWeekday: number;
    reminderTime: string;
  };
}) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(
    saveHouseholdSettings,
    undefined,
  );

  return (
    <form action={action} className="flex flex-col gap-5">
      <Field label="Household name">
        <input
          id="household-name"
          name="name"
          defaultValue={values.name}
          required
          className={inputClass}
        />
      </Field>

      <Field
        label="Timezone"
        hint="Everything — the lock time, reminders, what counts as today — is worked out in this zone."
      >
        <input
          id="timezone"
          name="timezone"
          defaultValue={values.timezone}
          required
          className={inputClass}
        />
      </Field>

      <Field
        label="Usual working days"
        hint="Individual dates can still be switched on the dashboard."
      >
        <div className="flex flex-wrap gap-2">
          {WEEKDAY_SHORT.map((short, index) => {
            const day = index + 1;
            return (
              <label
                key={day}
                className="cursor-pointer"
                title={WEEKDAY_NAMES[index]}
              >
                <input
                  type="checkbox"
                  name="workingWeekdays"
                  value={day}
                  defaultChecked={values.workingWeekdays.includes(day)}
                  className="peer sr-only"
                />
                <span
                  className={cn(
                    "inline-flex h-10 w-14 items-center justify-center rounded-lg border border-line-strong bg-surface text-xs font-bold text-ink-2 transition-colors",
                    "peer-checked:border-accent peer-checked:bg-accent peer-checked:text-[var(--accent-ink)]",
                  )}
                >
                  {short}
                </span>
              </label>
            );
          })}
        </div>
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="List locks on">
          <select
            id="groceryLockWeekday"
            name="groceryLockWeekday"
            defaultValue={values.groceryLockWeekday}
            className={inputClass}
          >
            {WEEKDAY_NAMES.map((name, index) => (
              <option key={name} value={index + 1}>
                {name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="At">
          <input
            id="groceryLockTime"
            type="time"
            name="groceryLockTime"
            defaultValue={values.groceryLockTime.slice(0, 5)}
            className={inputClass}
          />
        </Field>
        <Field label="Order placed on">
          <select
            id="groceryOrderWeekday"
            name="groceryOrderWeekday"
            defaultValue={values.groceryOrderWeekday}
            className={inputClass}
          >
            {WEEKDAY_NAMES.map((name, index) => (
              <option key={name} value={index + 1}>
                {name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field
        label="Reminder time"
        hint="The lock-day nudge and the order-day summary both go out at this time."
      >
        <input
          id="reminderTime"
          type="time"
          name="reminderTime"
          defaultValue={values.reminderTime.slice(0, 5)}
          className={cn(inputClass, "max-w-36")}
        />
      </Field>

      <Message state={state} />

      <div>
        <button
          type="submit"
          disabled={pending}
          className={buttonClass("primary")}
        >
          {pending ? "Saving…" : "Save settings"}
        </button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------- the people -- */

export function EmployeeForm({
  employee,
}: {
  employee: { id: number; name: string; email: string } | null;
}) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(
    saveEmployee,
    undefined,
  );

  return (
    <form action={action} className="flex flex-col gap-5">
      {employee ? (
        <input type="hidden" name="id" value={employee.id} />
      ) : null}

      <Field
        label="Their name"
        hint="This is the name the whole app uses, on both your screens and theirs."
      >
        <input
          id="employee-name"
          name="name"
          defaultValue={employee?.name ?? ""}
          required
          placeholder="e.g. Grace Dlamini"
          className={inputClass}
        />
      </Field>

      <Field label="Email">
        <input
          id="employee-email"
          type="email"
          name="email"
          defaultValue={employee?.email ?? ""}
          required
          className={inputClass}
        />
      </Field>

      <Field
        label={employee ? "New password" : "Password"}
        hint={
          employee
            ? "Leave empty to keep the current one."
            : "At least 8 characters. Give it to them directly."
        }
      >
        <input
          id="employee-password"
          type="password"
          name="password"
          autoComplete="new-password"
          className={inputClass}
        />
      </Field>

      <Message state={state} />

      <div>
        <button
          type="submit"
          disabled={pending}
          className={buttonClass("primary")}
        >
          {pending ? "Saving…" : employee ? "Save" : "Create the account"}
        </button>
      </div>
    </form>
  );
}

export function OwnAccountForm({
  account,
}: {
  account: { name: string; email: string };
}) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(
    saveOwnAccount,
    undefined,
  );

  return (
    <form action={action} className="flex flex-col gap-5">
      <Field label="Your name">
        <input
          id="own-name"
          name="name"
          defaultValue={account.name}
          required
          className={inputClass}
        />
      </Field>

      <Field label="Email">
        <input
          id="own-email"
          type="email"
          name="email"
          defaultValue={account.email}
          required
          className={inputClass}
        />
      </Field>

      <Field label="New password" hint="Leave empty to keep the current one.">
        <input
          id="own-password"
          type="password"
          name="password"
          autoComplete="new-password"
          className={inputClass}
        />
      </Field>

      <Message state={state} />

      <div>
        <button
          type="submit"
          disabled={pending}
          className={buttonClass("primary")}
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
