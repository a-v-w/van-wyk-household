import type { Metadata } from "next";
import Link from "next/link";
import {
  Card,
  Chip,
  Empty,
  IconClock,
  IconPlus,
  buttonClass,
} from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { loadRecipes } from "@/lib/recipes";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Recipes" };

export default async function AdminRecipesPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  const viewer = await requireAdmin();
  const params = await searchParams;
  const showArchived = params.show === "archived";

  const all = await loadRecipes(viewer.household.id, true);
  const recipes = all.filter((recipe) =>
    showArchived ? recipe.archivedAt : !recipe.archivedAt,
  );

  return (
    <div className="flex flex-col gap-5 px-5 py-6 lg:px-8 lg:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="font-mono text-xs tracking-widest text-muted uppercase">
            Write it once, plan it any week
          </p>
          <h1 className="text-3xl leading-tight font-extrabold tracking-tight">
            Recipes
          </h1>
        </div>
        <Link href="/admin/recipes/new" className={buttonClass("primary")}>
          <IconPlus size={16} />
          New recipe
        </Link>
      </header>

      <p className="max-w-2xl text-sm text-ink-2">
        Attach a recipe to a dish on the menu and it appears with that meal, so
        the method is there without anyone having to ask.
      </p>

      <div className="flex">
        <Link
          href={showArchived ? "/admin/recipes" : "/admin/recipes?show=archived"}
          className="text-xs font-bold text-accent"
        >
          {showArchived ? "Show live recipes" : "Show archived"}
        </Link>
      </div>

      {recipes.length === 0 ? (
        <Card>
          <Empty
            title={showArchived ? "Nothing archived" : "No recipes yet"}
            hint={
              showArchived
                ? undefined
                : "Start with the meals that come round every week."
            }
          />
        </Card>
      ) : (
        <Card>
          <ul>
            {recipes.map((recipe) => (
              <li key={recipe.id} className="border-b border-line last:border-b-0">
                <Link
                  href={`/admin/recipes/${recipe.id}`}
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
                  {recipe.archivedAt ? <Chip tone="danger">Archived</Chip> : null}
                  {recipe.timesPlanned > 0 ? (
                    <Chip>
                      On the menu {recipe.timesPlanned}×
                    </Chip>
                  ) : null}
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
