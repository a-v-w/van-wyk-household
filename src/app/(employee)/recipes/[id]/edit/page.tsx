import type { Metadata } from "next";
import { EditRecipe } from "./edit-page";

export const metadata: Metadata = { title: "Edit recipe" };

/** A static shell; the recipe is fetched on the client by its id. */
export default async function EditOwnRecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EditRecipe id={id} />;
}
