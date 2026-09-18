"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, destroySession } from "@/lib/session";

export type LoginState = { error?: string } | undefined;

export async function login(
  _state: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter your email address and password." };
  }

  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  // The same message either way, so the form never reveals which emails exist.
  const ok = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || !ok) {
    return { error: "That email address and password do not match." };
  }

  await createSession({
    userId: user.id,
    householdId: user.householdId,
    role: user.role,
  });

  redirect(user.role === "admin" ? "/admin" : "/today");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}
