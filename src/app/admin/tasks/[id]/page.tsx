import type { Metadata } from "next";
import { TaskDetailPage } from "@/app/admin/tasks/[id]/task-detail-page";

export const metadata: Metadata = { title: "Edit task" };

/** A static shell; the editor fetches the task on the client. */
export default async function EditTaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TaskDetailPage id={id} />;
}
