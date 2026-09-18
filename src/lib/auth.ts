import "server-only";

import { and, eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { households, users, type Household, type User } from "@/db/schema";
import { readSession } from "@/lib/session";

export type Viewer = {
  user: User;
  household: Household;
  isAdmin: boolean;
};

/**
 * The single place that turns a session cookie into a real user. Cached per
 * request so a page and its server components share one round trip.
 */
export const currentViewer = cache(async (): Promise<Viewer | null> => {
  const session = await readSession();
  if (!session) return null;

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
  });
  // Someone who has left keeps their history but cannot get back in.
  if (!user || user.archivedAt) return null;

  const household = await db.query.households.findFirst({
    where: eq(households.id, user.householdId),
  });
  if (!household) return null;

  return { user, household, isAdmin: user.role === "admin" };
});

/** Redirects to the login page when nobody is signed in. */
export async function requireViewer(): Promise<Viewer> {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  return viewer;
}

/** Redirects employees away from admin-only pages and actions. */
export async function requireAdmin(): Promise<Viewer> {
  const viewer = await requireViewer();
  if (!viewer.isAdmin) redirect("/today");
  return viewer;
}

function byRoleThenName(a: User, b: User): number {
  if (a.role !== b.role) return a.role === "admin" ? -1 : 1;
  return a.name.localeCompare(b.name);
}

/** Everyone still with the household, admin first, for assignee pickers. */
export const householdMembers = cache(
  async (householdId: number): Promise<User[]> => {
    const members = await db.query.users.findMany({
      where: and(eq(users.householdId, householdId), isNull(users.archivedAt)),
    });
    return members.sort(byRoleThenName);
  },
);

/** Everyone ever, including people who have left. */
export const allHouseholdMembers = cache(
  async (householdId: number): Promise<User[]> => {
    const members = await db.query.users.findMany({
      where: eq(users.householdId, householdId),
    });
    return members.sort(byRoleThenName);
  },
);

/** The people who work here, in the order they are shown everywhere. */
export const householdStaff = cache(
  async (householdId: number): Promise<User[]> => {
    const members = await householdMembers(householdId);
    return members.filter((m) => m.role === "employee");
  },
);

/** The first employee, for screens that still need a sensible default. */
export const householdEmployee = cache(
  async (householdId: number): Promise<User | null> => {
    const staff = await householdStaff(householdId);
    return staff[0] ?? null;
  },
);

/** One person of this household, archived or not. */
export async function householdMember(
  householdId: number,
  userId: number,
): Promise<User | undefined> {
  return db.query.users.findFirst({
    where: and(eq(users.id, userId), eq(users.householdId, householdId)),
  });
}

/** "you" when it is the viewer, otherwise the person's own name. */
export function displayName(person: User, viewer: Viewer): string {
  return person.id === viewer.user.id ? "You" : person.name;
}

/** The first name, which is what most of the UI shows. */
export function firstName(person: Pick<User, "name">): string {
  return person.name.trim().split(/\s+/)[0] || person.name;
}

/** "AB" for Ada Brown, "A" for Ada. */
export function initials(person: Pick<User, "name">): string {
  const parts = person.name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
