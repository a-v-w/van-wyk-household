"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageError, PageSkeleton } from "@/components/skeleton";
import {
  Card,
  Chip,
  Empty,
  IconClock,
  IconPlus,
  buttonClass,
} from "@/components/ui";
import { useClientData } from "@/lib/client-data";
import type { RecipeListData } from "@/lib/page-data/recipes";

export function AdminRecipes() {
  const searchParams = useSearchParams();
  const archivedAsked = searchParams.get("show") === "archived";
  const { data, error, refresh } = useClientData<RecipeListData>(
    archivedAsked ? "/api/admin/recipes?show=archived" : "/api/admin/recipes",
  );

  if (error && !data) return <PageError message={error} onRetry={refresh} />;
  if (!data) return <PageSkeleton variant="admin" cards={1} />;

  // Read the mode from the data, so the labels always match the list shown.
  const { showArchived, recipes } = data;

  return (
    <div className="flex flex-col gap-5 px-5 py-6 lg:px-8 lg:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="font-mono text-xs tracking-widest text-muted uppercase">
            Write it once, plan it any week
          </p>
          <h1 className="text-3xl leading-tight font-extrabold tracking-tight">
            Recipes
          </h1>
        </div>
        <Link href="/admin/recipes/new" className={buttonClass("primary")}>
          <IconPlus size={16} />
          New recipe
        </Link>
      </header>

      <p className="max-w-2xl text-sm text-ink-2">
        Attach a recipe to a dish on the menu and it appears with that meal, so
        the method is there without anyone having to ask.
      </p>

      <div className="flex">
        <Link
          href={showArchived ? "/admin/recipes" : "/admin/recipes?show=archived"}
          className="text-xs font-bold text-accent"
        >
          {showArchived ? "Show live recipes" : "Show archived"}
        </Link>
      </div>

      {recipes.length === 0 ? (
        <Card>
          <Empty
            title={showArchived ? "Nothing archived" : "No recipes yet"}
            hint={
              showArchived
                ? undefined
                : "Start with the meals that come round every week."
            }
          />
        </Card>
      ) : (
        <Card>
          <ul>
            {recipes.map((recipe) => (
              <li key={recipe.id} className="border-b border-line last:border-b-0">
                <Link
                  href={`/admin/recipes/${recipe.id}`}
                  className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[15px] leading-snug font-bold">
                      {recipe.title}
                    </span>
                    {recipe.summary ? (
                      <span className="truncate text-[13px] text-ink-2">
                        {recipe.summary}
                      </span>
                    ) : null}
                  </div>
                  {recipe.archived ? <Chip tone="danger">Archived</Chip> : null}
                  {recipe.timesPlanned > 0 ? (
                    <Chip>On the menu {recipe.timesPlanned}×</Chip>
                  ) : null}
                  {recipe.prepMinutes ? (
                    <Chip>
                      <IconClock size={13} />
                      {recipe.prepMinutes} min
                    </Chip>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
