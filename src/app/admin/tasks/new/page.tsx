import type { Metadata } from "next";
import Link from "next/link";
import { TaskEditor } from "@/components/task-editor";
import { Card, IconChevronLeft } from "@/components/ui";
import { householdEmployee, householdMembers, requireAdmin } from "@/lib/auth";
import { isoWeekday, todayIn } from "@/lib/dates";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "New task" };

export default async function NewTaskPage() {
  const viewer = await requireAdmin();
  const members = await householdMembers(viewer.household.id);
  const employee = await householdEmployee(viewer.household.id);
  const today = todayIn(viewer.household.timezone);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-5 py-6 lg:px-8 lg:py-8">
      <Link
        href="/admin/tasks"
        className="flex items-center gap-1 text-sm font-bold text-accent"
      >
        <IconChevronLeft size={16} />
        All tasks
      </Link>

      <h1 className="text-3xl leading-tight font-extrabold tracking-tight">
        New task
      </h1>

      <Card className="p-5 lg:p-6">
        <TaskEditor
          currentUserId={viewer.user.id}
          people={members.map((m) => ({
            id: m.id,
            name: m.name,
            role: m.role,
          }))}
          previewDates={[]}
          values={{
            id: null,
            title: "",
            notes: "",
            kind: "recurring",
            // New tasks land on the employee by default; that is most of them.
            assignedTo: employee?.id ?? viewer.user.id,
            timeOfDay: "",
            workingDaysOnly: true,
            frequency: "weekly",
            interval: 1,
            weekdays: [isoWeekday(today)],
            monthDay: Number(today.split("-")[2]),
            dueDate: today,
            startDate: today,
            endDate: "",
          }}
        />
      </Card>
    </div>
  );
}
