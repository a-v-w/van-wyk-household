import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { RecipeEditor } from "@/components/recipe-editor";
import { Card, IconChevronLeft } from "@/components/ui";
import { requireViewer } from "@/lib/auth";
import { loadRecipe } from "@/lib/recipes";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Edit recipe" };

export default async function EditOwnRecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requireViewer();
  const { id } = await params;
  const recipeId = Number(id);
  if (!Number.isFinite(recipeId)) notFound();

  const recipe = await loadRecipe(recipeId, viewer.household.id);
  if (!recipe) notFound();

  // You can change what you wrote; the admin can change anything.
  if (!viewer.isAdmin && recipe.createdBy !== viewer.user.id) {
    redirect(`/recipes/${recipe.id}`);
  }

  return (
    <div className="flex flex-col gap-4 px-4 pt-2 pb-8">
      <Link
        href={`/recipes/${recipe.id}`}
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
          returnTo={`/recipes/${recipe.id}`}
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
    </div>
  );
}
