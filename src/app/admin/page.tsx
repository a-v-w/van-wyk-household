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
  StatTile,
  buttonClass,
} from "@/components/ui";
import { AttendanceTally } from "@/components/attendance-tally";
import { WorkdayStrip, type WorkdayCell } from "@/components/workday-strip";
import { firstName, householdMembers, requireAdmin } from "@/lib/auth";
import {
  endOfMonth,
  formatDate,
  formatDayDate,
  formatDayNumber,
  formatLongDate,
  formatMonth,
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
import { loadOccurrences } from "@/lib/tasks";
import {
  loadCalendars,
  summariseAttendance,
  STATUS_LABEL,
} from "@/lib/workdays";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Dashboard" };

export default async function AdminDashboard() {
  const viewer = await requireAdmin();
  const { household, user } = viewer;
  const today = todayIn(household.timezone);
  const monday = startOfIsoWeek(today);
  const week = isoWeek(today);

  // The attendance card counts the calendar month, so load that whole range and
  // reuse the calendar for the week strip.
  const monthStart = `${today.slice(0, 7)}-01`;
  const monthEnd = endOfMonth(today);
  const monthLabel = formatMonth(today);
  const members = await householdMembers(household.id);
  const staff = members.filter((m) => m.role === "employee");

  // Everyone's days at once: tasks are judged against their own assignee's
  // calendar, and the kitchen against whoever is in that day.
  const calendars = await loadCalendars(
    household,
    members.map((m) => m.id),
    monthStart,
    monthEnd,
  );

  // The attendance card follows the people who work here.
  const attendanceFor = staff.map((person) => ({
    person,
    attendance: summariseAttendance(
      household,
      calendars.for(person.id),
      monthStart,
      monthEnd,
      today,
    ),
  }));

  const [weekOccurrences, todayOccurrences, kitchen, cycle, awaiting] =
    await Promise.all([
      loadOccurrences({
        householdId: household.id,
        from: monday,
        to: week[6],
        calendars,
      }),
      // Everyone's, not just mine, and dragging in anything once-off that is
      // past its date and still not ticked.
      loadOccurrences({
        householdId: household.id,
        from: today,
        to: today,
        calendars,
        includeOverdue: true,
      }),
      loadDayKitchen(household.id, today, calendars),
      currentCycle(household),
      cyclesAwaitingOrder(household),
    ]);

  const view = await loadCycleView(cycle);
  const pending = view.items.filter((i) => i.status === "pending");
  const carried = pending.filter((i) => i.carryCount > 0);

  /* ------------------------------------------------------ task tracking -- */

  // Today, split the two ways that matter: still to do, and done.
  const outstandingToday = todayOccurrences.filter((o) => !o.done);
  const completedToday = todayOccurrences
    .filter((o) => o.done)
    .sort((a, b) => {
      const at = a.completedAt?.getTime() ?? 0;
      const bt = b.completedAt?.getTime() ?? 0;
      return bt - at; // most recently ticked first
    });

  // The week counts only what has actually come due, so Friday is not judged
  // against tasks that do not happen until Sunday.
  const weekDue = weekOccurrences.filter((o) => o.date <= today);
  const weekDone = weekDue.filter((o) => o.done);
  const weekToCome = weekOccurrences.filter((o) => o.date > today);

  const missedThisWeek = weekOccurrences.filter((o) => !o.done && o.date < today);

  const perPerson = members.map((person) => {
    const theirs = weekOccurrences.filter((o) => o.task.assignedTo === person.id);
    const due = theirs.filter((o) => o.date <= today);
    const theirToday = todayOccurrences.filter(
      (o) => o.task.assignedTo === person.id,
    );
    return {
      person,
      done: due.filter((o) => o.done).length,
      total: due.length,
      upcoming: theirs.filter((o) => o.date > today).length,
      todayDone: theirToday.filter((o) => o.done).length,
      todayTotal: theirToday.length,
    };
  });

  const percent = (done: number, total: number) =>
    total === 0 ? 0 : Math.round((done / total) * 100);

  // One strip per person who works here, so a second helper's week is visible
  // without leaving the dashboard.
  const defaults = new Set(household.workingWeekdays);
  const weekStrips = staff.map((person) => {
    const calendar = calendars.for(person.id);
    const days: WorkdayCell[] = week.map((date) => {
      const record = calendar.recordFor(date);
      const status = calendar.statusFor(date);
      const usual = defaults.has(isoWeekday(date)) ? "working" : "off";
      return {
        userId: person.id,
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
    return { person, days };
  });


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

      {weekStrips.length === 0 ? (
        <Card>
          <Empty
            title="Nobody works here yet"
            hint="Add the people who do in Settings, and their weeks appear here."
          />
        </Card>
      ) : (
        <Card className="flex flex-col gap-5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="label">
              The week · {formatDate(monday)} to {formatDate(week[6])}
            </span>
            <span className="text-[13px] text-muted">
              Click a day to record whether it was worked, off, sick or leave.
            </span>
          </div>
          {weekStrips.map(({ person, days }) => (
            <div key={person.id} className="flex flex-col gap-2">
              {weekStrips.length > 1 ? (
                <div className="flex items-center gap-2">
                  <Avatar name={person.name} role={person.role} size="sm" />
                  <span className="text-sm font-bold">{person.name}</span>
                  {person.jobTitle ? <Chip>{person.jobTitle}</Chip> : null}
                </div>
              ) : null}
              <WorkdayStrip days={days} />
            </div>
          ))}
        </Card>
      )}

      {attendanceFor.map(({ person, attendance }) => (
        <Card key={person.id} className="flex flex-col p-5">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <span className="label">
              Attendance · {monthLabel} · {person.name}
            </span>
            <Link
              href={`/admin/attendance?who=${person.id}`}
              className="text-[13px] font-bold text-accent"
            >
              Open attendance
            </Link>
          </div>

          <AttendanceTally attendance={attendance} />

          {attendance.exceptions.length > 0 ? (
            <div className="mt-4 flex flex-col gap-2 border-t border-line pt-3">
              <span className="label">Days that were different</span>
              <ul className="flex flex-col gap-1.5">
                {attendance.exceptions.slice(0, 6).map((entry) => (
                  <li
                    key={entry.date}
                    className="flex flex-wrap items-center gap-2 text-sm"
                  >
                    <span className="font-mono text-xs text-muted tabular">
                      {formatDayDate(entry.date)}
                    </span>
                    <Chip
                      tone={
                        entry.status === "sick"
                          ? "danger"
                          : entry.status === "leave"
                            ? "lock"
                            : entry.status === "working"
                              ? "accent"
                              : "neutral"
                      }
                    >
                      {STATUS_LABEL[entry.status]}
                    </Chip>
                    {entry.date > today ? (
                      <span className="text-xs text-muted">
                        still to come, so not counted yet
                      </span>
                    ) : null}
                    {entry.note ? (
                      <span className="min-w-0 flex-1 truncate text-ink-2">
                        {entry.note}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-4 border-t border-line pt-3 text-sm text-muted">
              Nothing out of the ordinary this month.
            </p>
          )}
        </Card>
      ))}

      {/* Tasks: what is done, what is not, today and across the week. */}
      <Card className="flex flex-col p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <span className="label">Tasks</span>
          <Link
            href="/admin/tasks"
            className="text-[13px] font-bold text-accent"
          >
            Manage tasks
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            label="Completed today"
            value={`${completedToday.length} / ${todayOccurrences.length}`}
            hint={`${percent(completedToday.length, todayOccurrences.length)}% of today's list`}
            tone={
              todayOccurrences.length > 0 &&
              completedToday.length === todayOccurrences.length
                ? "ok"
                : undefined
            }
          />
          <StatTile
            label="Outstanding today"
            value={outstandingToday.length}
            hint={
              outstandingToday.length === 0
                ? "Nothing left"
                : "Still to be ticked"
            }
            tone={outstandingToday.length > 0 ? "accent" : "ok"}
          />
          <StatTile
            label="Completed this week"
            value={`${weekDone.length} / ${weekDue.length}`}
            hint={
              weekToCome.length > 0
                ? `${weekToCome.length} more still to come`
                : "The week is fully due"
            }
          />
          <StatTile
            label="Missed"
            value={missedThisWeek.length}
            hint="Earlier this week, never ticked"
            tone={missedThisWeek.length > 0 ? "danger" : "ok"}
          />
        </div>

        {/* Who is carrying what, across the days that have come due. */}
        <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4">
          {perPerson.map(({ person, done, total, upcoming, todayDone, todayTotal }) => (
            <div key={person.id} className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2 text-sm font-bold">
                <Avatar name={person.name} role={person.role} size="sm" />
                <span className="min-w-0 flex-1 truncate">
                  {person.id === user.id ? "You" : person.name}
                </span>
                <span className="font-mono text-xs text-muted tabular">
                  today {todayDone} / {todayTotal} · week {done} / {total}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-3">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${percent(done, total)}%` }}
                />
              </div>
              {upcoming > 0 ? (
                <span className="text-xs text-muted">
                  {upcoming} still to come later this week
                </span>
              ) : null}
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-4 border-t border-line pt-4 lg:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="label">Outstanding today</span>
              <span className="font-mono text-xs text-muted tabular">
                {outstandingToday.length}
              </span>
            </div>
            <div className="overflow-hidden rounded-lg border border-line">
              {outstandingToday.length === 0 ? (
                <Empty
                  title="Everything today is ticked"
                  className="py-7"
                />
              ) : (
                <ul className="max-h-96 overflow-y-auto">
                  {outstandingToday.map((o) => (
                    <TaskRow
                      key={`out-${o.task.id}:${o.date}`}
                      row={{
                        taskId: o.task.id,
                        date: o.date,
                        title: o.task.title,
                        notes: null,
                        done: false,
                        time: formatTime(o.task.timeOfDay) || null,
                        rule: null,
                        overdue: o.overdue,
                        assigneeName: o.assignee
                          ? o.assignee.id === user.id
                            ? "You"
                            : o.assignee.name
                          : null,
                        showAssignee: true,
                        canTick: true,
                        completedLabel: null,
                      }}
                    />
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="label">Completed today</span>
              <span className="font-mono text-xs text-muted tabular">
                {completedToday.length}
              </span>
            </div>
            <div className="overflow-hidden rounded-lg border border-line">
              {completedToday.length === 0 ? (
                <Empty title="Nothing ticked off yet today" className="py-7" />
              ) : (
                <ul className="max-h-96 overflow-y-auto">
                  {completedToday.map((o) => (
                    <TaskRow
                      key={`done-${o.task.id}:${o.date}`}
                      row={{
                        taskId: o.task.id,
                        date: o.date,
                        title: o.task.title,
                        notes: null,
                        done: true,
                        time: null,
                        rule: null,
                        overdue: false,
                        assigneeName: o.assignee
                          ? o.assignee.id === user.id
                            ? "You"
                            : o.assignee.name
                          : null,
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
                      }}
                    />
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {missedThisWeek.length > 0 ? (
          <div className="mt-4 flex flex-col gap-2 border-t border-line pt-4">
            <div className="flex items-baseline justify-between gap-2">
              <span className="label text-danger">Missed earlier this week</span>
              <span className="font-mono text-xs text-muted tabular">
                {missedThisWeek.length}
              </span>
            </div>
            <ul className="flex flex-wrap gap-x-5 gap-y-1.5">
              {missedThisWeek.slice(0, 10).map((o) => (
                <li
                  key={`missed-${o.task.id}:${o.date}`}
                  className="flex items-center gap-2 text-sm"
                >
                  <span className="font-mono text-xs text-muted tabular">
                    {weekdayShort(o.date)}
                  </span>
                  <span>{o.task.title}</span>
                  {o.assignee && o.assignee.id !== user.id ? (
                    <span className="text-xs text-muted">
                      {firstName(o.assignee)}
                    </span>
                  ) : null}
                </li>
              ))}
              {missedThisWeek.length > 10 ? (
                <li className="text-sm text-muted">
                  and {missedThisWeek.length - 10} more
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
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
              {members
                .map((person) => ({
                  person,
                  count: pending.filter((i) => i.addedBy === person.id).length,
                }))
                .filter(({ person, count }) => count > 0 || person.id === user.id)
                .map(({ person, count }) => (
                  <div key={person.id} className="flex justify-between">
                    <span>
                      Added by {person.id === user.id ? "you" : person.name}
                    </span>
                    <span className="font-mono text-ink-2 tabular">{count}</span>
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
          {kitchen.todayBySlot.length === 0 && kitchen.prepAhead.length === 0 ? (
            <Empty
              title="No menu set for today"
              hint="Plan the week and the kitchen list fills itself in."
            />
          ) : (
            <ul>
              {/* Grouped by slot, so every lunch sits together. */}
              {kitchen.todayBySlot.flatMap((group) =>
                group.entries.map((meal, index) => (
                  <li
                    key={meal.id}
                    className="flex items-center gap-3 border-b border-line px-5 py-3 text-sm last:border-b-0"
                  >
                    <span className="label w-14 flex-none">
                      {index === 0 ? SLOT_LABEL[group.slot] : ""}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-semibold">
                      {meal.dish}
                    </span>
                    {meal.forWhom ? (
                      <Chip tone="accent">for {meal.forWhom}</Chip>
                    ) : null}
                    {meal.prepTiming === "day_before" ? (
                      <Chip tone={meal.prepDone ? "ok" : "lock"}>
                        {meal.prepDone ? "Prepped" : "Prep missed"}
                      </Chip>
                    ) : (
                      <Chip>On the day</Chip>
                    )}
                  </li>
                )),
              )}
              {kitchen.prepAhead.map((meal) => (
                <li
                  key={`prep-${meal.id}`}
                  className="flex items-center gap-3 border-b border-line bg-surface-2/60 px-5 py-3 text-sm last:border-b-0"
                >
                  <span className="label w-14 flex-none">Prep</span>
                  <span className="min-w-0 flex-1 truncate font-semibold">
                    {weekdayName(meal.date)}&apos;s {meal.slot}
                    {meal.forWhom ? ` for ${meal.forWhom}` : ""}: {meal.dish}
                  </span>
                  <Chip tone={meal.prepDone ? "ok" : "accent"}>
                    {meal.prepDone ? "Done" : "Day-before prep"}
                  </Chip>
                </li>
              ))}
            </ul>
          )}
        </Card>

      </div>
    </div>
  );
}
