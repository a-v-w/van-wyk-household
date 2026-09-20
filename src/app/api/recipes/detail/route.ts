import { pageData } from "@/lib/api";
import { loadRecipeDetail } from "@/lib/page-data/recipe-detail";

export const dynamic = "force-dynamic";

export const GET = pageData(loadRecipeDetail);
