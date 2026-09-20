"use client";

import Link from "next/link";
import { useEffect } from "react";
import { RecipeView } from "@/components/recipe-view";
import { PageError, PageSkeleton } from "@/components/skeleton";
import {
  Card,
  Empty,
  IconChevronLeft,
  IconPencil,
  buttonClass,
} from "@/components/ui";
import { useClientData } from "@/lib/client-data";
import type { RecipeDetailData } from "@/lib/page-data/recipe-detail";

export function RecipeDetail({ id }: { id: string }) {
  const { data, error, refresh } = useClientData<RecipeDetailData>(
    `/api/recipes/detail?id=${encodeURIComponent(id)}`,
  );

  // The tab used to be titled from generateMetadata; the shell is static now,
  // so the title follows the data once it arrives.
  useEffect(() => {
    if (data?.found) document.title = `${data.recipe.title} · Household`;
  }, [data]);

  if (error && !data) return <PageError message={error} onRetry={refresh} />;
  if (!data) return <PageSkeleton variant="employee" cards={1} />;

  return (
    <div className="flex flex-col gap-4 px-4 pt-2 pb-8">
      <div className="flex items-center justify-between gap-3 px-1">
        <Link
          href="/recipes"
          className="flex items-center gap-1 text-sm font-bold text-accent"
        >
          <IconChevronLeft size={16} />
          All recipes
        </Link>
        {data.found && data.recipe.canEdit ? (
          <Link
            href={`/recipes/${data.recipe.id}/edit`}
            className={buttonClass("secondary", "sm")}
          >
            <IconPencil size={14} />
            Edit
          </Link>
        ) : null}
      </div>

      {data.found ? (
        <Card className="p-5">
          <RecipeView recipe={data.recipe.reading} />
        </Card>
      ) : (
        <Card>
          <Empty
            title="Recipe not found"
            hint="It may have been removed, or the link is wrong."
          />
        </Card>
      )}
    </div>
  );
}
