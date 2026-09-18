import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RecipeView } from "@/components/recipe-view";
import { Card, IconChevronLeft } from "@/components/ui";
import { requireViewer } from "@/lib/auth";
import { loadRecipe } from "@/lib/recipes";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const viewer = await requireViewer();
  const { id } = await params;
  const recipe = await loadRecipe(Number(id), viewer.household.id);
  return { title: recipe?.title ?? "Recipe" };
}

export default async function EmployeeRecipePage({
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

  return (
    <div className="flex flex-col gap-4 px-4 pt-2 pb-8">
      <Link
        href="/recipes"
        className="flex items-center gap-1 px-1 text-sm font-bold text-accent"
      >
        <IconChevronLeft size={16} />
        All recipes
      </Link>

      <Card className="p-5">
        <RecipeView recipe={recipe} />
      </Card>
    </div>
  );
}
