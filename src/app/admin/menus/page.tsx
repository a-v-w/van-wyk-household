import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminMenusPage } from "@/app/admin/menus/menus-page";
import { PageSkeleton } from "@/components/skeleton";

export const metadata: Metadata = { title: "Menus" };

/** A static shell; the editor fetches the requested week on the client. */
export default function AdminMenusShell() {
  return (
    <Suspense fallback={<PageSkeleton variant="admin" cards={2} />}>
      <AdminMenusPage />
    </Suspense>
  );
}
