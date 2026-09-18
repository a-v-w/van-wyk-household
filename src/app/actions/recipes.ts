"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { recipes } from "@/db/schema";
import { requireViewer } from "@/lib/auth";
import { normaliseLines } from "@/lib/recipes";

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
  const viewer = await requireViewer();

  const id = Number(formData.get("id") ?? 0);
  const title = String(formData.get("title") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim() || null;
  const servings = String(formData.get("servings") ?? "").trim() || null;
  // Textareas come back with CRLF; store plain newlines so the steps split.
  const ingredients =
    normaliseLines(String(formData.get("ingredients") ?? "")).trim() || null;
  const method =
    normaliseLines(String(formData.get("method") ?? "")).trim() || null;
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
    if (!viewer.isAdmin && existing.createdBy !== viewer.user.id) {
      return { error: "That recipe belongs to someone else." };
    }

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
  const viewer = await requireViewer();
  const existing = await db.query.recipes.findFirst({
    where: and(
      eq(recipes.id, recipeId),
      eq(recipes.householdId, viewer.household.id),
    ),
  });
  if (!existing) return;
  if (!viewer.isAdmin && existing.createdBy !== viewer.user.id) return;

  await db
    .update(recipes)
    .set({ archivedAt: new Date() })
    .where(eq(recipes.id, recipeId));
  refresh();
}

export async function restoreRecipe(recipeId: number): Promise<void> {
  const viewer = await requireViewer();
  await db
    .update(recipes)
    .set({ archivedAt: null })
    .where(
      and(eq(recipes.id, recipeId), eq(recipes.householdId, viewer.household.id)),
    );
  refresh();
}
