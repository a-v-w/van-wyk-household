import "server-only";

import type { Viewer } from "@/lib/auth";
import { loadRecipes } from "@/lib/recipes";

/*
 * The recipe list as JSON, for both the admin book and the phone cookbook.
 * Each side shows a different subset of the fields; the shape is the same.
 */

export type RecipeListItem = {
  id: number;
  title: string;
  summary: string | null;
  prepMinutes: number | null;
  archived: boolean;
  /** How many times it has been put on the menu. */
  timesPlanned: number;
  /** Written by the person looking. */
  mine: boolean;
};

export type RecipeListData = {
  /** True when `?show=archived` asked for the archived ones instead. */
  showArchived: boolean;
  recipes: RecipeListItem[];
};

export async function loadRecipeList(
  viewer: Viewer,
  query: URLSearchParams,
): Promise<RecipeListData> {
  const showArchived = query.get("show") === "archived";
  const all = await loadRecipes(viewer.household.id, showArchived);
  const recipes = all
    .filter((recipe) => (showArchived ? recipe.archivedAt : !recipe.archivedAt))
    .map((recipe) => ({
      id: recipe.id,
      title: recipe.title,
      summary: recipe.summary,
      prepMinutes: recipe.prepMinutes,
      archived: recipe.archivedAt !== null,
      timesPlanned: recipe.timesPlanned,
      mine: recipe.createdBy === viewer.user.id,
    }));
  return { showArchived, recipes };
}
