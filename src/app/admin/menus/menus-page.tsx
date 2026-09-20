"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MenuEditor } from "@/components/menu-editor";
import { PageError, PageSkeleton } from "@/components/skeleton";
import {
  IconChevronLeft,
  IconChevronRight,
  buttonClass,
} from "@/components/ui";
import { useClientData } from "@/lib/client-data";
import type { AdminMenusData } from "@/lib/page-data/admin-menus";

export function AdminMenusPage() {
  const searchParams = useSearchParams();
  const week = searchParams.get("week");
  const { data, error, refresh } = useClientData<AdminMenusData>(
    week ? `/api/admin/menus?week=${encodeURIComponent(week)}` : "/api/admin/menus",
  );

  if (error && !data) return <PageError message={error} onRetry={refresh} />;
  if (!data) return <PageSkeleton variant="admin" cards={2} />;

  return (
    <div className="flex flex-col gap-5 px-5 py-6 lg:px-8 lg:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="font-mono text-xs tracking-widest text-muted uppercase">
            {data.label}
          </p>
          <h1 className="text-3xl leading-tight font-extrabold tracking-tight">
            Menu
          </h1>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/admin/menus?week=${data.previousMonday}`}
            className={buttonClass("secondary", "sm")}
          >
            <IconChevronLeft size={16} />
            Previous
          </Link>
          <Link
            href={`/admin/menus?week=${data.nextMonday}`}
            className={buttonClass("secondary", "sm")}
          >
            Next
            <IconChevronRight size={16} />
          </Link>
        </div>
      </header>

      <p className="max-w-2xl text-sm text-ink-2">
        A slot can hold more than one dish, so name who each is for when people
        eat differently. Mark a dish{" "}
        <strong className="font-semibold">day before</strong> and it appears on
        the kitchen list the previous working day, so a Monday dinner is prepped
        on Friday when nobody works the weekend.
      </p>

      {/* Keyed on the week so moving between weeks never carries edits over. */}
      <MenuEditor
        key={data.monday}
        days={data.days}
        monday={data.monday}
        previousMonday={data.previousMonday}
        recipes={data.recipes}
        groceryLists={data.groceryLists}
      />
    </div>
  );
}
