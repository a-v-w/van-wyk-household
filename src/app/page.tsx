import { redirect } from "next/navigation";
import { currentViewer } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const viewer = await currentViewer();
  redirect(viewer ? (viewer.isAdmin ? "/admin" : "/today") : "/login");
}
