import { pageData } from "@/lib/api";
import { loadToday } from "@/lib/page-data/today";

export const dynamic = "force-dynamic";

export const GET = pageData((viewer) => loadToday(viewer));
