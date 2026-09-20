import type { Metadata } from "next";
import Link from "next/link";
import { RecipeEditor } from "@/components/recipe-editor";
import { Card, IconChevronLeft } from "@/components/ui";

export const metadata: Metadata = { title: "New recipe" };

/** A pure form with nothing to load, so the whole page is static. */
export default function NewRecipePage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-5 py-6 lg:px-8 lg:py-8">
      <Link
        href="/admin/recipes"
        className="flex items-center gap-1 text-sm font-bold text-accent"
      >
        <IconChevronLeft size={16} />
        All recipes
      </Link>

      <h1 className="text-3xl leading-tight font-extrabold tracking-tight">
        New recipe
      </h1>

      <Card className="p-5 lg:p-6">
        <RecipeEditor
          returnTo="/admin/recipes"
          values={{
            id: null,
            title: "",
            summary: "",
            servings: "",
            prepMinutes: "",
            ingredients: "",
            method: "",
            sourceUrl: "",
          }}
        />
      </Card>
    </div>
  );
}
