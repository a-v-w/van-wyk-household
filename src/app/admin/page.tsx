import type { Metadata } from "next";
import { AdminDashboard } from "@/app/admin/dashboard";

export const metadata: Metadata = { title: "Dashboard" };

/** A static shell; the dashboard fetches its own data on the client. */
export default function AdminDashboardPage() {
  return <AdminDashboard />;
}
