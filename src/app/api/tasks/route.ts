import { pageData } from "@/lib/api";
import { loadTasks } from "@/lib/page-data/tasks";

export const dynamic = "force-dynamic";

export const GET = pageData((viewer) => loadTasks(viewer));
