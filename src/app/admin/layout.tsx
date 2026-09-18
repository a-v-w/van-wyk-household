import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { SideNav } from "@/components/nav";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Avatar,
  IconLogout,
  buttonClass,
} from "@/components/ui";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const viewer = await requireAdmin();

  return (
    <div className="flex min-h-dvh flex-col bg-bg lg:flex-row">
      <aside className="flex flex-col gap-5 border-b border-line bg-surface px-4 py-4 lg:w-60 lg:flex-none lg:border-r lg:border-b-0 lg:px-4 lg:py-6">
        <div className="flex items-center justify-between gap-2">
          <Link href="/admin" className="flex flex-col gap-0.5 px-1">
            <span className="text-base leading-tight font-extrabold tracking-tight">
              {viewer.household.name}
            </span>
            <span className="text-xs text-muted">Admin</span>
          </Link>
          <div className="flex items-center gap-2 lg:hidden">
            <ThemeToggle />
            <form action={logout}>
              <button
                type="submit"
                aria-label="Sign out"
                className={buttonClass("ghost", "sm", "h-9 w-9 px-0")}
              >
                <IconLogout size={16} />
              </button>
            </form>
          </div>
        </div>

        <SideNav />

        <div className="mt-auto hidden flex-col gap-3 lg:flex">
          <ThemeToggle className="w-full justify-center" />
          <div className="flex items-center gap-2 px-1">
            <Avatar name={viewer.user.name} role="admin" size="sm" />
            <span className="min-w-0 flex-1 truncate text-xs font-semibold text-ink-2">
              {viewer.user.name}
            </span>
            <form action={logout}>
              <button
                type="submit"
                aria-label="Sign out"
                title="Sign out"
                className={buttonClass("ghost", "sm", "h-8 w-8 px-0")}
              >
                <IconLogout size={16} />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
