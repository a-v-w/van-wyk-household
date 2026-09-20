import type { Metadata } from "next";
import { NewTaskPage } from "@/app/admin/tasks/new/new-task-page";

export const metadata: Metadata = { title: "New task" };

/** A static shell; the editor fetches its options on the client. */
export default function NewTaskShell() {
  return <NewTaskPage />;
}
