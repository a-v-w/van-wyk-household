import { pageData } from "@/lib/api";
import { loadAdminTasks } from "@/lib/page-data/admin-tasks";

export const dynamic = "force-dynamic";

export const GET = pageData(loadAdminTasks, { admin: true });
