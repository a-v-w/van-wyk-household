import { pageData } from "@/lib/api";
import { loadRecipeList } from "@/lib/page-data/recipes";

export const dynamic = "force-dynamic";

export const GET = pageData(loadRecipeList);
