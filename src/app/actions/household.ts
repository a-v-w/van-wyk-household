"use server";

import bcrypt from "bcryptjs";
import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { households, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { setWorkday } from "@/lib/workdays";

export type SettingsState = { error?: string; ok?: string } | undefined;

function refresh() {
  revalidatePath("/", "layout");
}

/* ----------------------------------------------------------- working days -- */

/** Marks one date as working or off, or clears the override. */
export async function setWorkdayOverride(
  date: string,
  isWorking: boolean | null,
): Promise<void> {
  const viewer = await requireAdmin();
  await setWorkday(viewer.household.id, date, isWorking);
  refresh();
}

/** Flips a date between working and not, relative to the household default. */
export async function toggleWorkday(
  date: string,
  currentlyWorking: boolean,
): Promise<void> {
  const viewer = await requireAdmin();
  const defaults = new Set(viewer.household.workingWeekdays);
  const [y, m, d] = date.split("-").map(Number);
  const jsDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const iso = jsDay === 0 ? 7 : jsDay;

  const wanted = !currentlyWorking;
  // Clear the override when the wanted state matches the household default.
  await setWorkday(
    viewer.household.id,
    date,
    defaults.has(iso) === wanted ? null : wanted,
  );
  refresh();
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
