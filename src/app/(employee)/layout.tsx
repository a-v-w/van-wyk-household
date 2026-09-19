import { redirect } from "next/navigation";
import { logout } from "@/app/actions/auth";
import { BottomNav } from "@/components/nav";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Avatar,
  IconLogout,
  buttonClass,
} from "@/components/ui";
import { requireViewer } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const viewer = await requireViewer();

  // The admin has their own, roomier surface.
  if (viewer.isAdmin) redirect("/admin");

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-bg">
      <header className="flex items-center justify-between gap-3 px-5 pt-5 pb-1">
        <div className="flex items-center gap-2.5">
          <Avatar name={viewer.user.name} role="employee" />
          <span className="text-sm font-bold">{viewer.user.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <form action={logout}>
            <button
              type="submit"
              aria-label="Sign out"
              title="Sign out"
              className={buttonClass("ghost", "sm", "h-9 w-9 px-0")}
            >
              <IconLogout size={16} />
            </button>
          </form>
        </div>
      </header>

      <main className="flex flex-1 flex-col">{children}</main>

      <BottomNav />
    </div>
  );
}
