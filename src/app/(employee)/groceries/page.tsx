import type { Metadata } from "next";
import { Suspense } from "react";
import { Groceries } from "@/app/(employee)/groceries/groceries-page";
import { PageSkeleton } from "@/components/skeleton";

export const metadata: Metadata = { title: "Groceries" };

/**
 * A static shell; the page fetches its own data on the client. The Suspense
 * boundary is what lets a page that reads `useSearchParams` prerender.
 */
export default function GroceriesPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="employee" />}>
      <Groceries />
    </Suspense>
  );
}
