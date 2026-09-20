import Link from "next/link";
import { SideNav } from "@/components/nav";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  HouseholdName,
  LogoutButton,
  ViewerAvatar,
  ViewerName,
} from "@/components/viewer";

/**
 * A static shell. The proxy has already checked the session cookie and the
 * role, and every page and action re-checks against the database; nothing
 * here needs to wait for it.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg lg:flex-row">
      <aside className="flex flex-col gap-5 border-b border-line bg-surface px-4 py-4 lg:w-60 lg:flex-none lg:border-r lg:border-b-0 lg:px-4 lg:py-6">
        <div className="flex items-center justify-between gap-2">
          <Link href="/admin" className="flex flex-col gap-0.5 px-1">
            <HouseholdName className="text-base leading-tight font-extrabold tracking-tight" />
            <span className="text-xs text-muted">Admin</span>
          </Link>
          <div className="flex items-center gap-2 lg:hidden">
            <ThemeToggle />
            <LogoutButton />
          </div>
        </div>

        <SideNav />

        <div className="mt-auto hidden flex-col gap-3 lg:flex">
          <ThemeToggle className="w-full justify-center" />
          <div className="flex items-center gap-2 px-1">
            <ViewerAvatar role="admin" size="sm" />
            <ViewerName className="min-w-0 flex-1 truncate text-xs font-semibold text-ink-2" />
            <LogoutButton className="h-8 w-8 px-0" />
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
