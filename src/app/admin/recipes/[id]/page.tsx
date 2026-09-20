import type { Metadata } from "next";
import { AdminEditRecipe } from "./recipe-page";

export const metadata: Metadata = { title: "Edit recipe" };

/** A static shell; the recipe is fetched on the client by its id. */
export default async function EditRecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AdminEditRecipe id={id} />;
}
