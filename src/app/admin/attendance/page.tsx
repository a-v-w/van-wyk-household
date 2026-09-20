import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminAttendance } from "@/app/admin/attendance/attendance-page";
import { PageSkeleton } from "@/components/skeleton";

export const metadata: Metadata = { title: "Attendance" };

/**
 * A static shell; the page fetches its own data on the client. The Suspense
 * boundary is what lets a component that reads the search params prerender.
 */
export default function AttendancePage() {
  return (
    <Suspense fallback={<PageSkeleton variant="admin" cards={3} />}>
      <AdminAttendance />
    </Suspense>
  );
}
