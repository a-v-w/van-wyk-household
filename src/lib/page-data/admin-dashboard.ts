import "server-only";

import type { TaskRowData } from "@/components/task-list";
import type { WorkdayCell } from "@/components/workday-strip";
import { firstName, householdMembers, type Viewer } from "@/lib/auth";
import {
  endOfMonth,
  formatDate,
  formatDayDate,
  formatDayNumber,
  formatMonth,
  formatTime,
  isoWeek,
  isoWeekday,
  startOfIsoWeek,
  todayIn,
  weekdayName,
  weekdayShort,
  type IsoDate,
} from "@/lib/dates";
import {
  currentCycle,
  currentLockDate,
  cyclesAwaitingOrder,
  loadCycleView,
  resolveList,
} from "@/lib/groceries";
import { loadDayKitchen, SLOT_LABEL } from "@/lib/meals";
import { loadOccurrences, type TaskOccurrence } from "@/lib/tasks";
import {
  loadCalendars,
  summariseAttendance,
  type Attendance,
} from "@/lib/workdays";

/* Everything the dashboard shows, already shaped and formatted, as JSON. */

export type DashboardPerson = {
  id: number;
  name: string;
  role: "admin" | "employee";
  jobTitle: string | null;
};

export type AdminDashboardData = {
  today: IsoDate;
  monday: IsoDate;
  weekEnd: IsoDate;
  monthLabel: string;
  weekStrips: { person: DashboardPerson; days: WorkdayCell[] }[];
  attendance: { person: DashboardPerson; summary: Attendance }[];
  tasks: {
    todayTotal: number;
    completedToday: number;
    outstandingToday: number;
    weekDone: number;
    weekDue: number;
    weekToCome: number;
    missed: number;
    perPerson: {
      person: DashboardPerson;
      label: string;
      done: number;
      total: number;
      upcoming: number;
      todayDone: number;
      todayTotal: number;
    }[];
    outstandingRows: TaskRowData[];
    completedRows: TaskRowData[];
    missedRows: { key: string; weekday: string; title: string; by: string | null }[];
  };
  grocery: {
    name: string;
    /** Null for a standing list, which never closes. */
    closes: { today: boolean; label: string } | null;
    pendingCount: number;
    pendingLabel: string;
    byPerson: { id: number; label: string; count: number }[];
    carried: number;
    /** A locked cycle still to be ordered, when there is one. */
    order: { label: string } | null;
  } | null;
  kitchen: {
    slots: {
      slot: string;
      label: string;
      entries: {
        id: number;
        dish: string;
        forWhom: string | null;
        prepTiming: "same_day" | "day_before";
        prepDone: boolean;
      }[];
    }[];
    prepAhead: { id: number; title: string; prepDone: boolean }[];
  };
};

function person(user: {
  id: number;
  name: string;
  role: "admin" | "employee";
  jobTitle: string | null;
}): DashboardPerson {
  return { id: user.id, name: user.name, role: user.role, jobTitle: user.jobTitle };
}

export async function loadAdminDashboard(
  viewer: Viewer,
): Promise<AdminDashboardData> {
  const { household, user } = viewer;
  const today = todayIn(household.timezone);
  const monday = startOfIsoWeek(today);
  const week = isoWeek(today);
  const monthStart = `${today.slice(0, 7)}-01`;
  const monthEnd = endOfMonth(today);

  // Members and the grocery list do not depend on each other.
  const [members, groceryList] = await Promise.all([
    householdMembers(household.id),
    resolveList(household),
  ]);
  const staff = members.filter((m) => m.role === "employee");

  const calendars = await loadCalendars(
    household,
    members.map((m) => m.id),
    monthStart,
    monthEnd,
  );

  const [weekOccurrences, todayOccurrences, kitchen, cycle] = await Promise.all(
    [
      loadOccurrences({
        householdId: household.id,
        from: monday,
        to: week[6],
        calendars,
      }),
      loadOccurrences({
        householdId: household.id,
        from: today,
        to: today,
        calendars,
        includeOverdue: true,
      }),
      loadDayKitchen(household.id, today, calendars),
      groceryList ? currentCycle(household, groceryList) : null,
    ],
  );

  const [view, awaiting] = await Promise.all([
    cycle && groceryList ? loadCycleView(groceryList, cycle) : null,
    groceryList ? cyclesAwaitingOrder(groceryList) : [],
  ]);

  /* ------------------------------------------------------------ people -- */

  const defaults = new Set(household.workingWeekdays);
  const weekStrips = staff.map((member) => {
    const calendar = calendars.for(member.id);
    const days: WorkdayCell[] = week.map((date) => {
      const record = calendar.recordFor(date);
      const status = calendar.statusFor(date);
      const usual = defaults.has(isoWeekday(date)) ? "working" : "off";
      return {
        userId: member.id,
        date,
        weekday: weekdayShort(date),
        dayNumber: formatDayNumber(date),
        longDate: formatDayDate(date),
        status,
        note: record?.note ?? null,
        isToday: date === today,
        exception: status !== usual,
      };
    });
    return { person: person(member), days };
  });

  const attendance = staff.map((member) => ({
    person: person(member),
    summary: summariseAttendance(
      household,
      calendars.for(member.id),
      monthStart,
      monthEnd,
      today,
    ),
  }));

  /* ------------------------------------------------------------- tasks -- */

  const assigneeLabel = (o: TaskOccurrence) =>
    o.assignee ? (o.assignee.id === user.id ? "You" : o.assignee.name) : null;

  const outstandingToday = todayOccurrences.filter((o) => !o.done);
  const completedToday = todayOccurrences
    .filter((o) => o.done)
    .sort(
      (a, b) =>
        (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0),
    );
  const weekDue = weekOccurrences.filter((o) => o.date <= today);
  const weekDone = weekDue.filter((o) => o.done);
  const weekToCome = weekOccurrences.filter((o) => o.date > today);
  const missedThisWeek = weekOccurrences.filter(
    (o) => !o.done && o.date < today,
  );

  const perPerson = members.map((member) => {
    const theirs = weekOccurrences.filter(
      (o) => o.task.assignedTo === member.id,
    );
    const due = theirs.filter((o) => o.date <= today);
    const theirToday = todayOccurrences.filter(
      (o) => o.task.assignedTo === member.id,
    );
    return {
      person: person(member),
      label: member.id === user.id ? "You" : member.name,
      done: due.filter((o) => o.done).length,
      total: due.length,
      upcoming: theirs.filter((o) => o.date > today).length,
      todayDone: theirToday.filter((o) => o.done).length,
      todayTotal: theirToday.length,
    };
  });

  const outstandingRows: TaskRowData[] = outstandingToday.map((o) => ({
    taskId: o.task.id,
    date: o.date,
    title: o.task.title,
    notes: null,
    done: false,
    time: formatTime(o.task.timeOfDay) || null,
    rule: null,
    overdue: o.overdue,
    assigneeName: assigneeLabel(o),
    showAssignee: true,
    canTick: true,
    completedLabel: null,
  }));

  const completedRows: TaskRowData[] = completedToday.map((o) => ({
    taskId: o.task.id,
    date: o.date,
    title: o.task.title,
    notes: null,
    done: true,
    time: null,
    rule: null,
    overdue: false,
    assigneeName: assigneeLabel(o),
    showAssignee: true,
    canTick: true,
    completedLabel: o.completedAt
      ? `Ticked ${o.completedAt.toLocaleTimeString("en-ZA", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: household.timezone,
        })}`
      : null,
  }));

  const missedRows = missedThisWeek.map((o) => ({
    key: `missed-${o.task.id}:${o.date}`,
    weekday: weekdayShort(o.date),
    title: o.task.title,
    by:
      o.assignee && o.assignee.id !== user.id ? firstName(o.assignee) : null,
  }));

  /* --------------------------------------------------------- groceries -- */

  const pending = view?.items.filter((i) => i.status === "pending") ?? [];
  const carried = pending.filter((i) => i.carryCount > 0);
  const nextOrder = awaiting.find((c) => c.id !== cycle?.id) ?? null;

  const grocery: AdminDashboardData["grocery"] = groceryList
    ? {
        name: groceryList.name,
        closes:
          groceryList.kind === "weekly"
            ? (() => {
                const lock = currentLockDate(household, groceryList);
                return lock === today
                  ? { today: true, label: "Closes today" }
                  : { today: false, label: `Closes ${formatDate(lock)}` };
              })()
            : null,
        pendingCount: pending.length,
        pendingLabel: cycle?.orderDate
          ? `items for the order on ${formatDate(cycle.orderDate)}`
          : "items waiting",
        byPerson: members
          .map((member) => ({
            id: member.id,
            label: `Added by ${member.id === user.id ? "you" : member.name}`,
            count: pending.filter((i) => i.addedBy === member.id).length,
          }))
          .filter(({ id, count }) => count > 0 || id === user.id),
        carried: carried.length,
        order: nextOrder
          ? {
              label: nextOrder.orderDate
                ? `Order ${formatDate(nextOrder.orderDate)}`
                : "Go and order",
            }
          : null,
      }
    : null;

  /* ----------------------------------------------------------- kitchen -- */

  const kitchenData: AdminDashboardData["kitchen"] = {
    slots: kitchen.todayBySlot.map((group) => ({
      slot: group.slot,
      label: SLOT_LABEL[group.slot],
      entries: group.entries.map((meal) => ({
        id: meal.id,
        dish: meal.dish,
        forWhom: meal.forWhom,
        prepTiming: meal.prepTiming,
        prepDone: meal.prepDone,
      })),
    })),
    prepAhead: kitchen.prepAhead.map((meal) => ({
      id: meal.id,
      title: `${weekdayName(meal.date)}'s ${meal.slot}${
        meal.forWhom ? ` for ${meal.forWhom}` : ""
      }: ${meal.dish}`,
      prepDone: meal.prepDone,
    })),
  };

  return {
    today,
    monday,
    weekEnd: week[6],
    monthLabel: formatMonth(today),
    weekStrips,
    attendance,
    tasks: {
      todayTotal: todayOccurrences.length,
      completedToday: completedToday.length,
      outstandingToday: outstandingToday.length,
      weekDone: weekDone.length,
      weekDue: weekDue.length,
      weekToCome: weekToCome.length,
      missed: missedThisWeek.length,
      perPerson,
      outstandingRows,
      completedRows,
      missedRows,
    },
    grocery,
    kitchen: kitchenData,
  };
}
