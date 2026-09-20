import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminGroceries } from "@/app/admin/groceries/groceries-page";
import { PageSkeleton } from "@/components/skeleton";

export const metadata: Metadata = { title: "Groceries" };

/**
 * A static shell; the page fetches its own data on the client. The Suspense
 * boundary is what lets a page that reads `useSearchParams` prerender.
 */
export default function AdminGroceriesPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="admin" />}>
      <AdminGroceries />
    </Suspense>
  );
}
