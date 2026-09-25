import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminMissedPage } from "@/app/admin/missed/missed-page";
import { PageSkeleton } from "@/components/skeleton";

export const metadata: Metadata = { title: "Missed" };

/** A static shell; the list fetches its own data on the client. */
export default function AdminMissedShell() {
  return (
    <Suspense fallback={<PageSkeleton variant="admin" cards={2} />}>
      <AdminMissedPage />
    </Suspense>
  );
}
