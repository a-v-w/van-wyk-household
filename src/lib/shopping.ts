import "server-only";

import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import {
  groceryItems,
  meals,
  type GroceryCategory,
  type GroceryCycle,
  type GroceryList,
  type Household,
  type Meal,
  type Recipe,
} from "@/db/schema";
import { currentCycle, isCycleOpen } from "@/lib/groceries";
import { ingredientLines } from "@/lib/recipes";
import type { IsoDate } from "@/lib/dates";

/** Units worth pulling out of the front of an ingredient line. */
const UNITS = [
  "g", "kg", "mg",
  "ml", "l", "litre", "litres",
  "tsp", "tbsp", "cup", "cups",
  "tin", "tins", "can", "cans",
  "pack", "packs", "packet", "packets",
  "roll", "rolls", "stick", "sticks",
  "bunch", "bunches", "clove", "cloves",
  "slice", "slices", "punnet", "punnets",
  "bottle", "bottles", "jar", "jars",
  "box", "boxes", "bag", "bags",
  "x",
];

const QUANTITY = new RegExp(
  `^\\s*((?:\\d+(?:[.,]\\d+)?|\\d+\\s*/\\s*\\d+|½|¼|¾)(?:\\s*-\\s*\\d+(?:[.,]\\d+)?)?)` +
    `\\s*(${UNITS.join("|")})?\\b\\.?\\s*(.+)$`,
  "i",
);

export type ParsedIngredient = { name: string; quantity: string | null };

/**
 * Splits "500 g chicken breast" into a quantity and a name, so the shopping
 * list reads the way a shopping list should. Anything that does not start with
 * a number is kept whole, which is the safe outcome.
 */
export function parseIngredient(line: string): ParsedIngredient {
  const trimmed = line.trim().replace(/\s+/g, " ");
  const match = QUANTITY.exec(trimmed);
  if (!match) return { name: trimmed, quantity: null };

  const [, amount, unit, rest] = match;
  const name = rest.trim();
  if (!name) return { name: trimmed, quantity: null };

  return {
    name: name.charAt(0).toUpperCase() + name.slice(1),
    quantity: `${amount.trim()}${unit ? ` ${unit.toLowerCase()}` : ""}`,
  };
}

/** A sensible aisle for an ingredient, so the list groups usefully. */
export function guessCategory(name: string): GroceryCategory {
  const text = name.toLowerCase();
  const fresh = [
    "chicken", "beef", "mince", "pork", "lamb", "fish", "salmon", "prawn",
    "milk", "cream", "butter", "cheese", "cheddar", "yoghurt", "yogurt", "egg",
    "onion", "garlic", "tomato", "potato", "carrot", "spinach", "lettuce",
    "pepper", "mushroom", "lemon", "lime", "apple", "banana", "leek", "herb",
    "parsley", "coriander", "basil", "salad", "broccoli", "pastry",
  ];
  const pantry = [
    "flour", "sugar", "rice", "pasta", "lasagne", "noodle", "oil", "vinegar",
    "stock", "tin", "tinned", "spice", "salt", "cinnamon", "curry", "sauce",
    "bean", "lentil", "oat", "cereal", "coffee", "tea", "honey", "yeast",
  ];

  if (fresh.some((word) => text.includes(word))) return "fresh";
  if (pantry.some((word) => text.includes(word))) return "pantry";
  return "other";
}

export type IngredientPlan = {
  meal: Meal & { recipe: Recipe | null };
  /** Null when the dish has no recipe attached. */
  ingredients: ParsedIngredient[] | null;
  /** True when this meal's ingredients are already on a list. */
  alreadyAdded: boolean;
};

/** Which meals in a range have a recipe, and whether it has been shopped for. */
export async function planForMeals(
  householdId: number,
  from: IsoDate,
  to: IsoDate,
): Promise<IngredientPlan[]> {
  const inRange = (await db.query.meals.findMany({
    where: and(
      eq(meals.householdId, householdId),
      gte(meals.date, from),
      lte(meals.date, to),
    ),
    with: { recipe: true },
    orderBy: [asc(meals.date), asc(meals.sortOrder), asc(meals.id)],
  })) as (Meal & { recipe: Recipe | null })[];

  const ids = inRange.map((m) => m.id);
  const shopped =
    ids.length === 0
      ? []
      : await db.query.groceryItems.findMany({
          where: inArray(groceryItems.sourceMealId, ids),
          columns: { sourceMealId: true },
        });
  const shoppedIds = new Set(shopped.map((i) => i.sourceMealId));

  return inRange.map((meal) => ({
    meal,
    ingredients: meal.recipe ? ingredientLines(meal.recipe).map(parseIngredient) : null,
    alreadyAdded: shoppedIds.has(meal.id),
  }));
}

/**
 * Puts one meal's recipe onto a list. Idempotent: a meal whose ingredients are
 * already there is skipped, so pressing the button twice changes nothing.
 */
export async function addMealIngredients(
  household: Household,
  list: GroceryList,
  meal: Meal & { recipe: Recipe | null },
  userId: number,
): Promise<{ added: number; cycle: GroceryCycle; skipped: boolean }> {
  const cycle = await currentCycle(household, list);

  const existing = await db.query.groceryItems.findFirst({
    where: eq(groceryItems.sourceMealId, meal.id),
  });
  if (existing) return { added: 0, cycle, skipped: true };

  const lines = meal.recipe ? ingredientLines(meal.recipe) : [];
  if (lines.length === 0) return { added: 0, cycle, skipped: false };

  const note = `For ${meal.dish}`;
  const values = lines.map((line) => {
    const parsed = parseIngredient(line);
    return {
      cycleId: cycle.id,
      addedBy: userId,
      name: parsed.name,
      quantity: parsed.quantity,
      category: guessCategory(parsed.name),
      note,
      sourceMealId: meal.id,
    };
  });

  await db.insert(groceryItems).values(values);
  return { added: values.length, cycle, skipped: false };
}

/** The meals in a range whose ingredients are already on a list. */
export async function shoppedMealIds(
  householdId: number,
  from: IsoDate,
  to: IsoDate,
): Promise<Set<number>> {
  const inRange = await db.query.meals.findMany({
    where: and(
      eq(meals.householdId, householdId),
      gte(meals.date, from),
      lte(meals.date, to),
    ),
    columns: { id: true },
  });
  if (inRange.length === 0) return new Set();

  const rows = await db.query.groceryItems.findMany({
    where: inArray(
      groceryItems.sourceMealId,
      inRange.map((m) => m.id),
    ),
    columns: { sourceMealId: true },
  });
  return new Set(
    rows
      .map((r) => r.sourceMealId)
      .filter((id): id is number => typeof id === "number"),
  );
}

/** Undoes the above: removes the items a meal put on a list. */
export async function removeMealIngredients(mealId: number): Promise<number> {
  const rows = await db
    .delete(groceryItems)
    .where(eq(groceryItems.sourceMealId, mealId))
    .returning({ id: groceryItems.id });
  return rows.length;
}

export { isCycleOpen };
