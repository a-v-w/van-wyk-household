import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/app/login/login-form";
import { ThemeToggle } from "@/components/theme-toggle";
import { Card } from "@/components/ui";
import { currentViewer } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  const viewer = await currentViewer();
  if (viewer) redirect(viewer.isAdmin ? "/admin" : "/today");

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-5 py-12">
      <div className="flex w-full max-w-sm items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-2xl font-extrabold tracking-tight">Household</h1>
          <p className="text-sm text-muted">Tasks, menus and groceries.</p>
        </div>
        <ThemeToggle />
      </div>

      <Card className="w-full max-w-sm p-6">
        <LoginForm />
      </Card>

      <p className="max-w-sm text-center text-xs text-muted">
        Accounts are created by the household admin. If you cannot get in, ask
        them to reset your password.
      </p>
    </main>
  );
}
