import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/skeleton";
import { AdminRecipes } from "./recipes-page";

export const metadata: Metadata = { title: "Recipes" };

/**
 * A static shell; the list fetches its own data on the client. The Suspense
 * boundary is what lets a page that reads `useSearchParams` prerender.
 */
export default function AdminRecipesPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="admin" cards={1} />}>
      <AdminRecipes />
    </Suspense>
  );
}
