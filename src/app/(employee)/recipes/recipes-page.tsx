"use client";

import Link from "next/link";
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

export function RecipeList() {
  const { data, error, refresh } = useClientData<RecipeListData>("/api/recipes");

  if (error && !data) return <PageError message={error} onRetry={refresh} />;
  if (!data) return <PageSkeleton variant="employee" cards={1} />;

  const { recipes } = data;

  return (
    <div className="flex flex-col gap-4 px-4 pt-2 pb-8">
      <header className="flex flex-col gap-3 px-1">
        <div className="flex flex-col gap-1">
          <p className="font-mono text-xs tracking-widest text-muted uppercase">
            The household&apos;s cookbook
          </p>
          <h1 className="text-[28px] leading-tight font-extrabold tracking-tight">
            Recipes
          </h1>
        </div>
        <div>
          <Link href="/recipes/new" className={buttonClass("primary")}>
            <IconPlus size={16} />
            Add a recipe
          </Link>
        </div>
      </header>

      {recipes.length === 0 ? (
        <Card>
          <Empty
            title="No recipes yet"
            hint="Write one down and it goes into the household cookbook."
          />
        </Card>
      ) : (
        <Card>
          <ul>
            {recipes.map((recipe) => (
              <li key={recipe.id} className="border-b border-line last:border-b-0">
                <Link
                  href={`/recipes/${recipe.id}`}
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
                  {recipe.mine ? <Chip tone="accent">Yours</Chip> : null}
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
