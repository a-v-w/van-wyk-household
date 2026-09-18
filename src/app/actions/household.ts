"use server";

import bcrypt from "bcryptjs";
import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { households, users, type WorkdayStatus } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import {
  clearWorkdayRange,
  setWorkday,
  setWorkdayRange,
  STATUS_CHOICES,
  STATUS_LABEL,
} from "@/lib/workdays";

export type SettingsState = { error?: string; ok?: string } | undefined;

function refresh() {
  revalidatePath("/", "layout");
}

/* ------------------------------------------------------------- attendance -- */

/**
 * Records what happened on one date: worked, off, off sick or on leave. The
 * record is cleared when the chosen status is what the usual pattern would give
 * anyway and there is nothing to note, so only real exceptions are stored.
 */
export async function setDayStatus(
  date: string,
  status: WorkdayStatus,
  note?: string,
): Promise<void> {
  const viewer = await requireAdmin();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;

  const defaults = new Set(viewer.household.workingWeekdays);
  const [y, m, d] = date.split("-").map(Number);
  const jsDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const weekday = jsDay === 0 ? 7 : jsDay;

  const usual: WorkdayStatus = defaults.has(weekday) ? "working" : "off";
  const trimmed = note?.trim() || null;

  await setWorkday(
    viewer.household.id,
    date,
    status === usual && !trimmed ? null : status,
    trimmed,
    viewer.user.id,
  );
  refresh();
}

/** Puts a date back to whatever the usual weekday pattern says. */
export async function clearDayStatus(date: string): Promise<void> {
  const viewer = await requireAdmin();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  await setWorkday(viewer.household.id, date, null, null, viewer.user.id);
  refresh();
}

export type RangeState = { error?: string; ok?: string } | undefined;

/**
 * Records a block of dates at once. This is how leave gets booked in advance:
 * pick the first and last day in December, choose Leave, save.
 */
export async function setDayRange(
  _state: RangeState,
  formData: FormData,
): Promise<RangeState> {
  const viewer = await requireAdmin();

  const from = String(formData.get("from") ?? "");
  const to = String(formData.get("to") ?? "") || from;
  const status = String(formData.get("status") ?? "") as WorkdayStatus;
  const note = String(formData.get("note") ?? "").trim() || null;
  const onlyWorkdays = formData.get("onlyWorkdays") === "on";

  const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
  if (!isDate(from) || !isDate(to)) return { error: "Pick both dates." };
  if (to < from) return { error: "The last day is before the first day." };
  if (!STATUS_CHOICES.includes(status)) return { error: "Pick what to record." };

  const days = Math.round(
    (Date.parse(to) - Date.parse(from)) / 86_400_000,
  );
  if (days > 365) return { error: "That is more than a year. Pick a shorter run." };

  const written = await setWorkdayRange(
    viewer.household.id,
    from,
    to,
    status,
    note,
    viewer.user.id,
    onlyWorkdays,
    viewer.household.workingWeekdays,
  );

  refresh();

  if (written === 0) {
    return {
      error: "Nothing was recorded: every day in that run is already a day off.",
    };
  }
  return {
    ok: `${written} ${written === 1 ? "day" : "days"} recorded as ${STATUS_LABEL[status].toLowerCase()}.`,
  };
}

/** Wipes every record in a range, back to the usual pattern. */
export async function clearDayRange(
  _state: RangeState,
  formData: FormData,
): Promise<RangeState> {
  const viewer = await requireAdmin();

  const from = String(formData.get("from") ?? "");
  const to = String(formData.get("to") ?? "") || from;
  const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
  if (!isDate(from) || !isDate(to)) return { error: "Pick both dates." };
  if (to < from) return { error: "The last day is before the first day." };

  await clearWorkdayRange(viewer.household.id, from, to);
  refresh();
  return { ok: "Those days follow the usual pattern again." };
}

/* --------------------------------------------------------------- settings -- */

export async function saveHouseholdSettings(
  _state: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const viewer = await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "").trim();
  const reminderTime = String(formData.get("reminderTime") ?? "").trim();
  const groceryLockTime = String(formData.get("groceryLockTime") ?? "").trim();
  const groceryLockWeekday = Number(formData.get("groceryLockWeekday") ?? 5);
  const groceryOrderWeekday = Number(formData.get("groceryOrderWeekday") ?? 1);
  const workingWeekdays = formData
    .getAll("workingWeekdays")
    .map(Number)
    .filter((n) => n >= 1 && n <= 7);

  if (!name) return { error: "The household needs a name." };
  if (!timezone) return { error: "Pick a timezone." };
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone });
  } catch {
    return { error: `"${timezone}" is not a timezone this server knows.` };
  }
  if (workingWeekdays.length === 0) {
    return { error: "Pick at least one working day." };
  }

  await db
    .update(households)
    .set({
      name,
      timezone,
      reminderTime: reminderTime || "09:00",
      groceryLockTime: groceryLockTime || "18:00",
      groceryLockWeekday,
      groceryOrderWeekday,
      workingWeekdays,
    })
    .where(eq(households.id, viewer.household.id));

  refresh();
  return { ok: "Settings saved." };
}

/* ------------------------------------------------------------ the account -- */

/**
 * Creates or updates the employee's account. Their name is what the whole app
 * shows — no screen says "the nanny" once this is filled in.
 */
export async function saveEmployee(
  _state: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const viewer = await requireAdmin();

  const id = Number(formData.get("id") ?? 0);
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!name) return { error: "Enter their name." };
  if (!email || !email.includes("@")) return { error: "Enter a valid email address." };
  if (!id && password.length < 8) {
    return { error: "Set a password of at least 8 characters." };
  }
  if (id && password && password.length < 8) {
    return { error: "The new password must be at least 8 characters." };
  }

  const clash = await db.query.users.findFirst({
    where: id
      ? and(eq(users.email, email), ne(users.id, id))
      : eq(users.email, email),
  });
  if (clash) return { error: "Another account already uses that email address." };

  if (id) {
    const existing = await db.query.users.findFirst({
      where: and(eq(users.id, id), eq(users.householdId, viewer.household.id)),
    });
    if (!existing) return { error: "That account is not in this household." };

    await db
      .update(users)
      .set({
        name,
        email,
        ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
      })
      .where(eq(users.id, id));

    refresh();
    return { ok: password ? "Saved, with a new password." : "Saved." };
  }

  await db.insert(users).values({
    householdId: viewer.household.id,
    name,
    email,
    role: "employee",
    passwordHash: await bcrypt.hash(password, 10),
  });

  refresh();
  return { ok: `${name.split(/\s+/)[0]} can sign in now.` };
}

/** Updates the admin's own name, email and password. */
export async function saveOwnAccount(
  _state: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const viewer = await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!name) return { error: "Enter your name." };
  if (!email.includes("@")) return { error: "Enter a valid email address." };
  if (password && password.length < 8) {
    return { error: "The new password must be at least 8 characters." };
  }

  const clash = await db.query.users.findFirst({
    where: and(eq(users.email, email), ne(users.id, viewer.user.id)),
  });
  if (clash) return { error: "Another account already uses that email address." };

  await db
    .update(users)
    .set({
      name,
      email,
      ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
    })
    .where(eq(users.id, viewer.user.id));

  refresh();
  return { ok: "Saved." };
}
