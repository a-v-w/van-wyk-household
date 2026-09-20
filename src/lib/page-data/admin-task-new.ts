import "server-only";

import type { EditorPerson, TaskEditorValues } from "@/components/task-editor";
import { householdMembers, type Viewer } from "@/lib/auth";
import { isoWeekday, todayIn } from "@/lib/dates";

/* What the editor needs to start a new task: the people and the defaults. */

export type AdminTaskNewData = {
  currentUserId: number;
  people: EditorPerson[];
  values: TaskEditorValues;
};

export async function loadAdminTaskNew(
  viewer: Viewer,
): Promise<AdminTaskNewData> {
  const { household, user } = viewer;
  const members = await householdMembers(household.id);
  // Members come admin first, then employees by name; the first employee is
  // the default assignee, as most tasks land there.
  const employee = members.find((m) => m.role === "employee") ?? null;
  const today = todayIn(household.timezone);

  return {
    currentUserId: user.id,
    people: members.map((m) => ({ id: m.id, name: m.name, role: m.role })),
    values: {
      id: null,
      title: "",
      notes: "",
      kind: "recurring",
      assignedTo: employee?.id ?? user.id,
      timeOfDay: "",
      workingDaysOnly: true,
      frequency: "weekly",
      interval: 1,
      weekdays: [isoWeekday(today)],
      monthDay: Number(today.split("-")[2]),
      dueDate: today,
      startDate: today,
      endDate: "",
    },
  };
}
