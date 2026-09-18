import "server-only";

import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { meals, recipes, type Recipe } from "@/db/schema";

export type RecipeWithUse = Recipe & {
  /** How many times it has been put on the menu. */
  timesPlanned: number;
};

/**
 * Browsers submit textarea content with CRLF line endings, so everything that
 * reads stored prose normalises first. Without this a typed recipe's steps all
 * ran together as one long paragraph under a single number.
 */
export function normaliseLines(value: string | null): string {
  return (value ?? "").replace(/\r\n?/g, "\n");
}

/** One line per ingredient, blanks dropped. */
export function ingredientLines(recipe: Pick<Recipe, "ingredients">): string[] {
  return normaliseLines(recipe.ingredients)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/** The method split into steps, so it can be numbered. */
export function methodSteps(recipe: Pick<Recipe, "method">): string[] {
  return normaliseLines(recipe.method)
    .split(/\n{2,}|\n(?=\d+[.)]\s)/)
    .map((step) => step.replace(/^\s*\d+[.)]\s*/, "").trim())
    .filter(Boolean);
}

/** Only links we are willing to render, so a stored value cannot inject one. */
export function safeSourceUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}

export async function loadRecipes(
  householdId: number,
  includeArchived = false,
): Promise<RecipeWithUse[]> {
  const rows = await db.query.recipes.findMany({
    where: and(
      eq(recipes.householdId, householdId),
      includeArchived ? undefined : isNull(recipes.archivedAt),
    ),
    orderBy: [asc(recipes.title)],
  });
  if (rows.length === 0) return [];

  const planned = await db.query.meals.findMany({
    where: eq(meals.householdId, householdId),
    columns: { recipeId: true },
  });

  const counts = new Map<number, number>();
  for (const meal of planned) {
    if (meal.recipeId === null) continue;
    counts.set(meal.recipeId, (counts.get(meal.recipeId) ?? 0) + 1);
  }

  return rows.map((recipe) => ({
    ...recipe,
    timesPlanned: counts.get(recipe.id) ?? 0,
  }));
}

export async function loadRecipe(
  recipeId: number,
  householdId: number,
): Promise<Recipe | undefined> {
  return db.query.recipes.findFirst({
    where: and(eq(recipes.id, recipeId), eq(recipes.householdId, householdId)),
  });
}

/** Just enough to fill the picker in the menu editor. */
export async function recipeOptions(
  householdId: number,
): Promise<{ id: number; title: string }[]> {
  const rows = await db.query.recipes.findMany({
    where: and(eq(recipes.householdId, householdId), isNull(recipes.archivedAt)),
    columns: { id: true, title: true },
    orderBy: [asc(recipes.title)],
  });
  return rows;
}
