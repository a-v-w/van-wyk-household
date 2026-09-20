import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminTasksPage } from "@/app/admin/tasks/tasks-page";
import { PageSkeleton } from "@/components/skeleton";

export const metadata: Metadata = { title: "Tasks" };

/** A static shell; the list fetches its own data on the client. */
export default function AdminTasksShell() {
  return (
    <Suspense fallback={<PageSkeleton variant="admin" cards={2} />}>
      <AdminTasksPage />
    </Suspense>
  );
}
