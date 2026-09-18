import type { Metadata } from "next";
import { TaskRow } from "@/components/task-list";
import { Card, Chip, Empty } from "@/components/ui";
import { requireViewer } from "@/lib/auth";
import {
  formatDayDate,
  formatTime,
  isoWeek,
  relativeDay,
  shiftDate,
  todayIn,
} from "@/lib/dates";
import { describeRule, loadOccurrences } from "@/lib/tasks";
import { loadWorkdayCalendar } from "@/lib/workdays";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Tasks" };

export default async function TasksPage() {
  const viewer = await requireViewer();
  const { household, user } = viewer;
  const today = todayIn(household.timezone);
  const to = shiftDate(today, 13);

  const calendar = await loadWorkdayCalendar(household, today, to);
  const occurrences = await loadOccurrences({
    householdId: household.id,
    from: today,
    to,
    calendar,
    assigneeId: user.id,
  });

  const days = [...isoWeek(today), ...isoWeek(shiftDate(today, 7))]
    .filter((d) => d >= today && d <= to)
    .sort();

  return (
    <div className="flex flex-col gap-5 px-4 pt-2 pb-8">
      <header className="flex flex-col gap-1 px-1">
        <p className="font-mono text-xs tracking-widest text-muted uppercase">
          Next two weeks
        </p>
        <h1 className="text-[28px] leading-tight font-extrabold tracking-tight">
          Your tasks
        </h1>
      </header>

      {occurrences.length === 0 ? (
        <Card>
          <Empty
            title="Nothing scheduled"
            hint="Tasks the household adds for you will show up here."
          />
        </Card>
      ) : (
        days.map((date) => {
          const forDay = occurrences.filter((o) => o.date === date);
          if (forDay.length === 0) return null;
          const working = calendar.isWorking(date);

          return (
            <section key={date} className="flex flex-col gap-2">
              <div className="flex items-center gap-2 px-1">
                <h2 className="label">{relativeDay(date, today)}</h2>
                <span className="font-mono text-xs text-muted">
                  {formatDayDate(date)}
                </span>
                {!working ? (
                  <Chip tone="lock" className="ml-auto">
                    Not a working day
                  </Chip>
                ) : null}
              </div>
              <Card>
                <ul>
                  {forDay.map((o) => (
                    <TaskRow
                      key={`${o.task.id}:${o.date}`}
                      row={{
                        taskId: o.task.id,
                        date: o.date,
                        title: o.task.title,
                        notes: o.task.notes,
                        done: o.done,
                        time: formatTime(o.task.timeOfDay) || null,
                        rule:
                          o.task.kind === "recurring"
                            ? describeRule(o.task)
                            : null,
                        overdue: o.overdue,
                        assigneeName: null,
                        showAssignee: false,
                        canTick: date <= today,
                        completedLabel: null,
                      }}
                    />
                  ))}
                </ul>
              </Card>
            </section>
          );
        })
      )}
    </div>
  );
}
