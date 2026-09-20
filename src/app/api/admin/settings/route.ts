import { pageData } from "@/lib/api";
import { loadAdminSettings } from "@/lib/page-data/admin-settings";

export const dynamic = "force-dynamic";

export const GET = pageData((viewer) => loadAdminSettings(viewer), {
  admin: true,
});
