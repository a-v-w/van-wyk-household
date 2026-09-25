import { pageData } from "@/lib/api";
import { loadAdminMissed } from "@/lib/page-data/admin-missed";

export const dynamic = "force-dynamic";

export const GET = pageData(loadAdminMissed, { admin: true });
