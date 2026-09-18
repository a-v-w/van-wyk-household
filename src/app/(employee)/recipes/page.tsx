import type { Metadata } from "next";
import Link from "next/link";
import { Card, Chip, Empty, IconClock } from "@/components/ui";
import { requireViewer } from "@/lib/auth";
import { loadRecipes } from "@/lib/recipes";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Recipes" };

export default async function RecipesPage() {
  const viewer = await requireViewer();
  const recipes = await loadRecipes(viewer.household.id);

  return (
    <div className="flex flex-col gap-4 px-4 pt-2 pb-8">
      <header className="flex flex-col gap-1 px-1">
        <p className="font-mono text-xs tracking-widest text-muted uppercase">
          The household&apos;s cookbook
        </p>
        <h1 className="text-[28px] leading-tight font-extrabold tracking-tight">
          Recipes
        </h1>
      </header>

      {recipes.length === 0 ? (
        <Card>
          <Empty
            title="No recipes yet"
            hint="Anything written down for a meal will show up here."
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
