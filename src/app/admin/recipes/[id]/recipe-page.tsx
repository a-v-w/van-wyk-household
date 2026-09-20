"use client";

import Link from "next/link";
import { RecipeEditor } from "@/components/recipe-editor";
import { RecipeView } from "@/components/recipe-view";
import { PageError, PageSkeleton } from "@/components/skeleton";
import {
  Card,
  CardHeader,
  Chip,
  Empty,
  IconChevronLeft,
} from "@/components/ui";
import { useClientData } from "@/lib/client-data";
import type { RecipeDetailData } from "@/lib/page-data/recipe-detail";

export function AdminEditRecipe({ id }: { id: string }) {
  const { data, error, refresh } = useClientData<RecipeDetailData>(
    `/api/admin/recipes/detail?id=${encodeURIComponent(id)}`,
  );

  if (error && !data) return <PageError message={error} onRetry={refresh} />;
  if (!data) return <PageSkeleton variant="admin" cards={2} />;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-5 py-6 lg:px-8 lg:py-8">
      <Link
        href="/admin/recipes"
        className="flex items-center gap-1 text-sm font-bold text-accent"
      >
        <IconChevronLeft size={16} />
        All recipes
      </Link>

      {!data.found ? (
        <Card>
          <Empty
            title="Recipe not found"
            hint="It may have been removed, or the link is wrong."
          />
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl leading-tight font-extrabold tracking-tight">
              Edit recipe
            </h1>
            {data.recipe.archived ? <Chip tone="danger">Archived</Chip> : null}
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
            <Card className="p-5 lg:p-6">
              <RecipeEditor
                returnTo="/admin/recipes"
                values={data.recipe.values}
              />
            </Card>

            <Card className="lg:sticky lg:top-6">
              <CardHeader title="How it reads in the kitchen" />
              <div className="px-5 pt-1 pb-5">
                <RecipeView recipe={data.recipe.reading} />
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
