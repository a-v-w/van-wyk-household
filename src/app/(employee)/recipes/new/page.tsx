import type { Metadata } from "next";
import Link from "next/link";
import { RecipeEditor } from "@/components/recipe-editor";
import { Card, IconChevronLeft } from "@/components/ui";
import { requireViewer } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "New recipe" };

export default async function NewRecipePage() {
  await requireViewer();

  return (
    <div className="flex flex-col gap-4 px-4 pt-2 pb-8">
      <Link
        href="/recipes"
        className="flex items-center gap-1 px-1 text-sm font-bold text-accent"
      >
        <IconChevronLeft size={16} />
        All recipes
      </Link>

      <h1 className="px-1 text-[28px] leading-tight font-extrabold tracking-tight">
        New recipe
      </h1>
      <p className="px-1 text-sm text-ink-2">
        Anything you write here goes into the household cookbook, and can be
        put on the menu.
      </p>

      <Card className="p-5">
        <RecipeEditor
          returnTo="/recipes"
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
