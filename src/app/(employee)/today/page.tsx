import type { Metadata } from "next";
import { TodayPage } from "@/app/(employee)/today/today-page";

export const metadata: Metadata = { title: "Today" };

/** A static shell; the page fetches its own data on the client. */
export default function TodayShell() {
  return <TodayPage />;
}
