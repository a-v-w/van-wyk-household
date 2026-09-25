"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import {
  IconBook,
  IconCalendar,
  IconCart,
  IconChecklist,
  IconClock,
  IconGrid,
  IconList,
  IconMenu,
  IconSettings,
  cn,
} from "@/components/ui";

type NavItem = {
  href: string;
  label: string;
  Icon: ComponentType<{ className?: string; size?: number }>;
  /** Match child routes too, not just an exact path. */
  prefix?: boolean;
};

/**
 * The lists live here rather than in the layouts: icons are functions, and a
 * server component cannot hand a function to a client one.
 */
const EMPLOYEE_ITEMS: NavItem[] = [
  { href: "/today", label: "Today", Icon: IconChecklist },
  { href: "/tasks", label: "Tasks", Icon: IconList },
  { href: "/menu", label: "Menu", Icon: IconMenu },
  { href: "/recipes", label: "Recipes", Icon: IconBook, prefix: true },
  { href: "/groceries", label: "Groceries", Icon: IconCart },
];

const ADMIN_ITEMS: NavItem[] = [
  { href: "/admin", label: "Dashboard", Icon: IconGrid },
  { href: "/admin/tasks", label: "Tasks", Icon: IconChecklist, prefix: true },
  { href: "/admin/missed", label: "Missed", Icon: IconClock, prefix: true },
  {
    href: "/admin/attendance",
    label: "Attendance",
    Icon: IconCalendar,
    prefix: true,
  },
  { href: "/admin/menus", label: "Menus", Icon: IconMenu, prefix: true },
  { href: "/admin/recipes", label: "Recipes", Icon: IconBook, prefix: true },
  { href: "/admin/groceries", label: "Groceries", Icon: IconCart, prefix: true },
  { href: "/admin/settings", label: "Settings", Icon: IconSettings },
];

function isActive(pathname: string, item: NavItem): boolean {
  if (item.prefix) {
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }
  return pathname === item.href;
}

/** The employee's bottom bar. Fixed, thumb-reachable, safe-area aware. */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="sticky bottom-0 z-20 flex border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      {EMPLOYEE_ITEMS.map((item) => {
        const active = isActive(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-bold transition-colors",
              active ? "text-accent" : "text-muted hover:text-ink-2",
            )}
          >
            <item.Icon size={22} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** The admin's side rail on desktop; a scrolling row on narrow screens. */
export function SideNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible"
    >
      {ADMIN_ITEMS.map((item) => {
        const active = isActive(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors",
              active
                ? "bg-accent-soft text-accent"
                : "text-ink-2 hover:bg-surface-2",
            )}
          >
            <item.Icon size={18} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
