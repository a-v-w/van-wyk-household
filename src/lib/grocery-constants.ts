import type { GroceryCategory } from "@/db/schema";

/**
 * Plain values, safe to import from client components. Everything that needs
 * the database lives in `@/lib/groceries`, which is server-only.
 */
export const CATEGORIES: GroceryCategory[] = [
  "fresh",
  "pantry",
  "household",
  "baby",
  "other",
];

export const CATEGORY_LABEL: Record<GroceryCategory, string> = {
  fresh: "Fresh",
  pantry: "Pantry",
  household: "Household",
  baby: "Baby",
  other: "Other",
};
