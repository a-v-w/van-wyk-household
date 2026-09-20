import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/** The proxy normally handles "/"; this covers anything it did not match. */
export default async function Home() {
  const session = await readSession();
  redirect(session ? (session.role === "admin" ? "/admin" : "/today") : "/login");
}
