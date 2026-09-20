import type { Metadata } from "next";
import { TasksPage } from "@/app/(employee)/tasks/tasks-page";

export const metadata: Metadata = { title: "Tasks" };

/** A static shell; the list fetches its own data on the client. */
export default function TasksShell() {
  return <TasksPage />;
}
