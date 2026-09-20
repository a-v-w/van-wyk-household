import type { Metadata } from "next";
import { RecipeList } from "./recipes-page";

export const metadata: Metadata = { title: "Recipes" };

/** A static shell; the cookbook fetches its own data on the client. */
export default function RecipesPage() {
  return <RecipeList />;
}
