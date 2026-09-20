import { pageData } from "@/lib/api";
import { loadAdminGroceries } from "@/lib/page-data/admin-groceries";

export const dynamic = "force-dynamic";

export const GET = pageData(loadAdminGroceries, { admin: true });
