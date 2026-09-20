"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { RecipeEditor } from "@/components/recipe-editor";
import { PageError, PageSkeleton } from "@/components/skeleton";
import { Card, Empty, IconChevronLeft } from "@/components/ui";
import { useClientData } from "@/lib/client-data";
import type { RecipeDetailData } from "@/lib/page-data/recipe-detail";

export function EditRecipe({ id }: { id: string }) {
  const router = useRouter();
  const { data, error, refresh } = useClientData<RecipeDetailData>(
    `/api/recipes/detail?id=${encodeURIComponent(id)}`,
  );

  // You can change what you wrote; the admin can change anything. Anyone else
  // is sent back to the recipe, as the page used to redirect on the server.
  const sentBack = data?.found === true && !data.recipe.canEdit;
  useEffect(() => {
    if (sentBack) router.replace(`/recipes/${id}`);
  }, [sentBack, router, id]);

  if (error && !data) return <PageError message={error} onRetry={refresh} />;
  if (!data || sentBack) return <PageSkeleton variant="employee" cards={1} />;

  if (!data.found) {
    return (
      <div className="flex flex-col gap-4 px-4 pt-2 pb-8">
        <Link
          href="/recipes"
          className="flex items-center gap-1 px-1 text-sm font-bold text-accent"
        >
          <IconChevronLeft size={16} />
          All recipes
        </Link>
        <Card>
          <Empty
            title="Recipe not found"
            hint="It may have been removed, or the link is wrong."
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-4 pt-2 pb-8">
      <Link
        href={`/recipes/${data.recipe.id}`}
        className="flex items-center gap-1 px-1 text-sm font-bold text-accent"
      >
        <IconChevronLeft size={16} />
        Back to the recipe
      </Link>

      <h1 className="px-1 text-[28px] leading-tight font-extrabold tracking-tight">
        Edit recipe
      </h1>

      <Card className="p-5">
        <RecipeEditor
          returnTo={`/recipes/${data.recipe.id}`}
          values={data.recipe.values}
        />
      </Card>
    </div>
  );
}
