import { pageData } from "@/lib/api";
import { loadGroceries } from "@/lib/page-data/groceries";

export const dynamic = "force-dynamic";

export const GET = pageData(loadGroceries);
