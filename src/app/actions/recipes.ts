"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { recipes } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";

export type RecipeFormState =
  | { error?: string; ok?: boolean; id?: number }
  | undefined;

function refresh() {
  revalidatePath("/recipes");
  revalidatePath("/menu");
  revalidatePath("/today");
  revalidatePath("/admin/recipes");
  revalidatePath("/admin/menus");
}

export async function saveRecipe(
  _state: RecipeFormState,
  formData: FormData,
): Promise<RecipeFormState> {
  const viewer = await requireAdmin();

  const id = Number(formData.get("id") ?? 0);
  const title = String(formData.get("title") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim() || null;
  const servings = String(formData.get("servings") ?? "").trim() || null;
  const ingredients = String(formData.get("ingredients") ?? "").trim() || null;
  const method = String(formData.get("method") ?? "").trim() || null;
  const rawUrl = String(formData.get("sourceUrl") ?? "").trim();
  const minutes = String(formData.get("prepMinutes") ?? "").trim();

  if (!title) return { error: "Give the recipe a name." };

  let sourceUrl: string | null = null;
  if (rawUrl) {
    const candidate = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
    try {
      sourceUrl = new URL(candidate).toString();
    } catch {
      return { error: "That link does not look like a web address." };
    }
  }

  const prepMinutes = minutes ? Number(minutes) : null;
  if (prepMinutes !== null && (!Number.isFinite(prepMinutes) || prepMinutes < 0)) {
    return { error: "Time should be a number of minutes." };
  }

  const values = {
    title,
    summary,
    servings,
    prepMinutes: prepMinutes === null ? null : Math.min(600, prepMinutes),
    ingredients,
    method,
    sourceUrl,
  };

  if (id) {
    const existing = await db.query.recipes.findFirst({
      where: and(eq(recipes.id, id), eq(recipes.householdId, viewer.household.id)),
    });
    if (!existing) return { error: "That recipe no longer exists." };

    await db.update(recipes).set(values).where(eq(recipes.id, id));
    refresh();
    return { ok: true, id };
  }

  const [created] = await db
    .insert(recipes)
    .values({
      ...values,
      householdId: viewer.household.id,
      createdBy: viewer.user.id,
    })
    .returning({ id: recipes.id });

  refresh();
  return { ok: true, id: created?.id };
}

export async function archiveRecipe(recipeId: number): Promise<void> {
  const viewer = await requireAdmin();
  await db
    .update(recipes)
    .set({ archivedAt: new Date() })
    .where(
      and(eq(recipes.id, recipeId), eq(recipes.householdId, viewer.household.id)),
    );
  refresh();
}

export async function restoreRecipe(recipeId: number): Promise<void> {
  const viewer = await requireAdmin();
  await db
    .update(recipes)
    .set({ archivedAt: null })
    .where(
      and(eq(recipes.id, recipeId), eq(recipes.householdId, viewer.household.id)),
    );
  refresh();
}
