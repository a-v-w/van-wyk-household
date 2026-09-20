import "server-only";

import type { RecipeValues } from "@/components/recipe-editor";
import type { RecipeReading } from "@/components/recipe-view";
import type { Viewer } from "@/lib/auth";
import {
  ingredientLines,
  loadRecipe,
  methodSteps,
  safeSourceUrl,
} from "@/lib/recipes";

/*
 * One recipe, shaped for every page that shows it: the editor's field values,
 * the reading view the kitchen sees, and whether the viewer may change it.
 */

export type RecipeDetailData =
  | { found: false }
  | {
      found: true;
      recipe: {
        id: number;
        title: string;
        archived: boolean;
        /** Admins may change anything; everyone else only what they wrote. */
        canEdit: boolean;
        values: RecipeValues;
        reading: RecipeReading;
      };
    };

export async function loadRecipeDetail(
  viewer: Viewer,
  query: URLSearchParams,
): Promise<RecipeDetailData> {
  const recipeId = Number(query.get("id"));
  if (!Number.isFinite(recipeId)) return { found: false };

  const recipe = await loadRecipe(recipeId, viewer.household.id);
  if (!recipe) return { found: false };

  return {
    found: true,
    recipe: {
      id: recipe.id,
      title: recipe.title,
      archived: recipe.archivedAt !== null,
      canEdit: viewer.isAdmin || recipe.createdBy === viewer.user.id,
      values: {
        id: recipe.id,
        title: recipe.title,
        summary: recipe.summary ?? "",
        servings: recipe.servings ?? "",
        prepMinutes:
          recipe.prepMinutes === null ? "" : String(recipe.prepMinutes),
        ingredients: recipe.ingredients ?? "",
        method: recipe.method ?? "",
        sourceUrl: recipe.sourceUrl ?? "",
      },
      reading: {
        title: recipe.title,
        summary: recipe.summary,
        servings: recipe.servings,
        prepMinutes: recipe.prepMinutes,
        ingredients: ingredientLines(recipe),
        steps: methodSteps(recipe),
        link: safeSourceUrl(recipe.sourceUrl),
      },
    },
  };
}
