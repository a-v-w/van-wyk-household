import { BottomNav } from "@/components/nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoutButton, ViewerAvatar, ViewerName } from "@/components/viewer";

/**
 * A static shell. The proxy sends admins to their own surface and anyone
 * signed out to the login page; pages fetch their own data.
 */
export default function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-bg">
      <header className="flex items-center justify-between gap-3 px-5 pt-5 pb-1">
        <div className="flex items-center gap-2.5">
          <ViewerAvatar role="employee" />
          <ViewerName className="text-sm font-bold" />
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LogoutButton />
        </div>
      </header>

      <main className="flex flex-1 flex-col">{children}</main>

      <BottomNav />
    </div>
  );
}
