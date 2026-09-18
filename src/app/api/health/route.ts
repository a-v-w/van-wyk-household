import { sql } from "drizzle-orm";
import { db } from "@/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Both the pg and neon-http drivers return a result with a `rows` array.
    const result = (await db.execute(sql`select now()::text as now`)) as unknown as {
      rows: { now: string }[];
    };
    return Response.json({ ok: true, database: "up", now: result.rows[0]?.now ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ ok: false, database: "down", error: message }, { status: 503 });
  }
}
