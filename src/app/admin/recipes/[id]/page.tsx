import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RecipeEditor } from "@/components/recipe-editor";
import { RecipeView } from "@/components/recipe-view";
import { Card, CardHeader, Chip, IconChevronLeft } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { loadRecipe } from "@/lib/recipes";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Edit recipe" };

export default async function EditRecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requireAdmin();
  const { id } = await params;
  const recipeId = Number(id);
  if (!Number.isFinite(recipeId)) notFound();

  const recipe = await loadRecipe(recipeId, viewer.household.id);
  if (!recipe) notFound();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-5 py-6 lg:px-8 lg:py-8">
      <Link
        href="/admin/recipes"
        className="flex items-center gap-1 text-sm font-bold text-accent"
      >
        <IconChevronLeft size={16} />
        All recipes
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl leading-tight font-extrabold tracking-tight">
          Edit recipe
        </h1>
        {recipe.archivedAt ? <Chip tone="danger">Archived</Chip> : null}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
        <Card className="p-5 lg:p-6">
          <RecipeEditor
            returnTo="/admin/recipes"
            values={{
              id: recipe.id,
              title: recipe.title,
              summary: recipe.summary ?? "",
              servings: recipe.servings ?? "",
              prepMinutes:
                recipe.prepMinutes === null ? "" : String(recipe.prepMinutes),
              ingredients: recipe.ingredients ?? "",
              method: recipe.method ?? "",
              sourceUrl: recipe.sourceUrl ?? "",
            }}
          />
        </Card>

        <Card className="lg:sticky lg:top-6">
          <CardHeader title="How it reads in the kitchen" />
          <div className="px-5 pt-1 pb-5">
            <RecipeView recipe={recipe} />
          </div>
        </Card>
      </div>
    </div>
  );
}
