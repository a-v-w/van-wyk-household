import { pageData } from "@/lib/api";
import { loadMenu } from "@/lib/page-data/menu";

export const dynamic = "force-dynamic";

export const GET = pageData((viewer) => loadMenu(viewer));
