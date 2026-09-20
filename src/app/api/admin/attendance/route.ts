import { pageData } from "@/lib/api";
import { loadAdminAttendance } from "@/lib/page-data/admin-attendance";

export const dynamic = "force-dynamic";

export const GET = pageData(loadAdminAttendance, { admin: true });
