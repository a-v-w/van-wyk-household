import { pageData } from "@/lib/api";
import { loadAdminTaskDetail } from "@/lib/page-data/admin-task-detail";

export const dynamic = "force-dynamic";

export const GET = pageData(loadAdminTaskDetail, { admin: true });
