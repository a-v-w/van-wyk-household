import { pageData } from "@/lib/api";
import { loadAdminDashboard } from "@/lib/page-data/admin-dashboard";

export const dynamic = "force-dynamic";

export const GET = pageData((viewer) => loadAdminDashboard(viewer), {
  admin: true,
});
