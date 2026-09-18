import type { Metadata } from "next";
import Link from "next/link";
import { TaskRow } from "@/components/task-list";
import {
  Avatar,
  Card,
  CardHeader,
  Chip,
  Empty,
  IconArrowRight,
  IconLock,
  buttonClass,
} from "@/components/ui";
import { WorkdayStrip, type WorkdayCell } from "@/components/workday-strip";
import { householdMembers, requireAdmin } from "@/lib/auth";
import {
  formatDate,
  formatDayNumber,
  formatLongDate,
  formatTime,
  isoWeek,
  isoWeekday,
  startOfIsoWeek,
  todayIn,
  weekdayName,
  weekdayShort,
} from "@/lib/dates";
import {
  currentCycle,
  currentLockDate,
  cyclesAwaitingOrder,
  loadCycleView,
} from "@/lib/groceries";
import { loadDayKitchen, SLOT_LABEL } from "@/lib/meals";
import { describeRule, loadOccurrences } from "@/lib/tasks";
import { loadWorkdayCalendar } from "@/lib/workdays";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Dashboard" };

export default async function AdminDashboard() {
  const viewer = await requireAdmin();
  const { household, user } = viewer;
  const today = todayIn(household.timezone);
  const monday = startOfIsoWeek(today);
  const week = isoWeek(today);

  const calendar = await loadWorkdayCalendar(household, monday, week[6]);
  const members = await householdMembers(household.id);

  const [weekOccurrences, myToday, kitchen, cycle, awaiting] = await Promise.all(
    [
      loadOccurrences({
        householdId: household.id,
        from: monday,
        to: week[6],
        calendar,
      }),
      loadOccurrences({
        householdId: household.id,
        from: today,
        to: today,
        calendar,
        assigneeId: user.id,
        includeOverdue: true,
      }),
      loadDayKitchen(household.id, today, calendar),
      currentCycle(household),
      cyclesAwaitingOrder(household),
    ],
  );

  const view = await loadCycleView(cycle);
  const pending = view.items.filter((i) => i.status === "pending");
  const carried = pending.filter((i) => i.carryCount > 0);

  const perPerson = members.map((person) => {
    const theirs = weekOccurrences.filter((o) => o.task.assignedTo === person.id);
    const due = theirs.filter((o) => o.date <= today);
    return {
      person,
      done: due.filter((o) => o.done).length,
      total: due.length,
      upcoming: theirs.filter((o) => o.date > today).length,
    };
  });

  const missed = weekOccurrences
    .filter((o) => !o.done && o.date < today)
    .slice(0, 6);

  const defaults = new Set(household.workingWeekdays);
  const days: WorkdayCell[] = week.map((date) => ({
    date,
    weekday: weekdayShort(date),
    dayNumber: formatDayNumber(date),
    working: calendar.isWorking(date),
    isToday: date === today,
    overridden:
      calendar.isWorking(date) && !defaults.has(isoWeekday(date)),
  }));

  const employeeTodayList = weekOccurrences.filter(
    (o) => o.date === today && o.task.assignedTo !== user.id,
  );

  return (
    <div className="flex flex-col gap-6 px-5 py-6 lg:px-8 lg:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="font-mono text-xs tracking-widest text-muted uppercase">
            {formatLongDate(today)}
          </p>
          <h1 className="text-3xl leading-tight font-extrabold tracking-tight">
            This week
          </h1>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/tasks/new" className={buttonClass("primary")}>
            New task
          </Link>
          <Link href="/admin/menus" className={buttonClass("secondary")}>
            Plan the menu
          </Link>
        </div>
      </header>

      <Card className="p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="label">
            Working days · {formatDate(monday)} to {formatDate(week[6])}
          </span>
          <span className="text-[13px] text-muted">
            Click a day to switch it between working and off.
          </span>
        </div>
        <WorkdayStrip days={days} />
      </Card>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="flex flex-col">
          <CardHeader title="Tasks this week" />
          <div className="flex flex-col gap-4 px-5 pt-1 pb-5">
            {perPerson.map(({ person, done, total, upcoming }) => (
              <div key={person.id} className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2 text-sm font-bold">
                  <Avatar name={person.name} role={person.role} size="sm" />
                  <span className="flex-1 truncate">
                    {person.id === user.id ? "You" : person.name}
                  </span>
                  <span className="font-mono text-xs text-muted tabular">
                    {done} / {total}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-3">
                  <div
                    className="h-full rounded-full bg-accent transition-[width]"
                    style={{
                      width: `${total === 0 ? 0 : Math.round((done / total) * 100)}%`,
                    }}
                  />
                </div>
                {upcoming > 0 ? (
                  <span className="text-xs text-muted">
                    {upcoming} still to come this week
                  </span>
                ) : null}
              </div>
            ))}

            {missed.length > 0 ? (
              <div className="flex flex-col gap-1.5 border-t border-line pt-3">
                <span className="label text-danger">Missed</span>
                {missed.map((o) => (
                  <div
                    key={`${o.task.id}:${o.date}`}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="truncate">{o.task.title}</span>
                    <span className="flex-none font-mono text-xs text-muted">
                      {weekdayShort(o.date)}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </Card>

        <Card className="flex flex-col">
          <CardHeader
            title="Grocery list"
            action={
              currentLockDate(household) === today ? (
                <Chip tone="lock">
                  <IconLock size={14} />
                  Locks today
                </Chip>
              ) : (
                <Chip>Locks {formatDate(currentLockDate(household))}</Chip>
              )
            }
          />
          <div className="flex flex-1 flex-col gap-3 px-5 pt-1 pb-5">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-4xl leading-none font-bold tabular">
                {pending.length}
              </span>
              <span className="text-sm text-ink-2">
                items for the order on {formatDate(cycle.orderDate)}
              </span>
            </div>

            <div className="flex flex-col gap-1 text-sm">
              {members.map((person) => (
                <div key={person.id} className="flex justify-between">
                  <span>
                    Added by {person.id === user.id ? "you" : person.name}
                  </span>
                  <span className="font-mono text-ink-2 tabular">
                    {pending.filter((i) => i.addedBy === person.id).length}
                  </span>
                </div>
              ))}
              {carried.length > 0 ? (
                <div className="flex justify-between text-lock">
                  <span>Of those, carried over</span>
                  <span className="font-mono tabular">{carried.length}</span>
                </div>
              ) : null}
            </div>

            <div className="mt-auto flex flex-wrap gap-2 pt-2">
              <Link
                href="/admin/groceries"
                className={buttonClass("secondary", "sm")}
              >
                Open the list
              </Link>
              {awaiting.length > 0 ? (
                <Link
                  href="/admin/groceries"
                  className={buttonClass("primary", "sm")}
                >
                  Order {formatDate(awaiting[0].orderDate)}
                  <IconArrowRight size={16} />
                </Link>
              ) : null}
            </div>
          </div>
        </Card>

        <Card className="flex flex-col">
          <CardHeader title="Your tasks today" />
          {myToday.length === 0 ? (
            <Empty title="Nothing for you today" />
          ) : (
            <ul>
              {myToday.map((o) => (
                <TaskRow
                  key={`${o.task.id}:${o.date}`}
                  row={{
                    taskId: o.task.id,
                    date: o.date,
                    title: o.task.title,
                    notes: null,
                    done: o.done,
                    time: formatTime(o.task.timeOfDay) || null,
                    rule:
                      o.task.kind === "recurring" ? describeRule(o.task) : null,
                    overdue: o.overdue,
                    assigneeName: null,
                    showAssignee: false,
                    canTick: true,
                    completedLabel: null,
                  }}
                />
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="flex flex-col">
          <CardHeader
            title="Meals today"
            action={
              <Link
                href="/admin/menus"
                className="text-[13px] font-bold text-accent"
              >
                Edit menu
              </Link>
            }
          />
          {kitchen.today.length === 0 && kitchen.prepAhead.length === 0 ? (
            <Empty
              title="No menu set for today"
              hint="Plan the week and the kitchen list fills itself in."
            />
          ) : (
            <ul>
              {kitchen.today.map((meal) => (
                <li
                  key={meal.id}
                  className="flex items-center gap-3 border-b border-line px-5 py-3 text-sm last:border-b-0"
                >
                  <span className="label w-14 flex-none">
                    {SLOT_LABEL[meal.slot]}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-semibold">
                    {meal.dish}
                  </span>
                  {meal.prepTiming === "day_before" ? (
                    <Chip tone={meal.prepDone ? "ok" : "lock"}>
                      {meal.prepDone ? "Prepped" : "Prep missed"}
                    </Chip>
                  ) : (
                    <Chip tone="accent">On the day</Chip>
                  )}
                </li>
              ))}
              {kitchen.prepAhead.map((meal) => (
                <li
                  key={`prep-${meal.id}`}
                  className="flex items-center gap-3 border-b border-line bg-surface-2/60 px-5 py-3 text-sm last:border-b-0"
                >
                  <span className="label w-14 flex-none">Prep</span>
                  <span className="min-w-0 flex-1 truncate font-semibold">
                    {weekdayName(meal.date)}&apos;s {meal.slot}: {meal.dish}
                  </span>
                  <Chip tone={meal.prepDone ? "ok" : "accent"}>
                    {meal.prepDone ? "Done" : "Day-before prep"}
                  </Chip>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="flex flex-col">
          <CardHeader title="The household's day so far" />
          {employeeTodayList.length === 0 ? (
            <Empty title="No one else has tasks today" />
          ) : (
            <ul>
              {employeeTodayList.map((o) => (
                <TaskRow
                  key={`${o.task.id}:${o.date}`}
                  row={{
                    taskId: o.task.id,
                    date: o.date,
                    title: o.task.title,
                    notes: null,
                    done: o.done,
                    time: formatTime(o.task.timeOfDay) || null,
                    rule: null,
                    overdue: o.overdue,
                    assigneeName: o.assignee?.name ?? null,
                    showAssignee: members.length > 2,
                    canTick: true,
                    completedLabel: o.completedAt
                      ? `Done ${o.completedAt.toLocaleTimeString("en-ZA", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                          timeZone: household.timezone,
                        })}`
                      : null,
                  }}
                />
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
