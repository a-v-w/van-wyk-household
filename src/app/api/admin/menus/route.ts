import { pageData } from "@/lib/api";
import { loadAdminMenus } from "@/lib/page-data/admin-menus";

export const dynamic = "force-dynamic";

export const GET = pageData(loadAdminMenus, { admin: true });
