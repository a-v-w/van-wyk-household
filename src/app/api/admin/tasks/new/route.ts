import { pageData } from "@/lib/api";
import { loadAdminTaskNew } from "@/lib/page-data/admin-task-new";

export const dynamic = "force-dynamic";

export const GET = pageData((viewer) => loadAdminTaskNew(viewer), {
  admin: true,
});
