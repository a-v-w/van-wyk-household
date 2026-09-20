import type { Metadata } from "next";
import { RecipeDetail } from "./recipe-page";

export const metadata: Metadata = { title: "Recipe" };

/** A static shell; the recipe is fetched on the client by its id. */
export default async function EmployeeRecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RecipeDetail id={id} />;
}
