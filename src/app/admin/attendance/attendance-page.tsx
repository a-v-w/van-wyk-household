"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AttendanceCalendar } from "@/components/attendance-calendar";
import { AttendanceRangeForm } from "@/components/attendance-range-form";
import { AttendanceTally } from "@/components/attendance-tally";
import { PageError, PageSkeleton } from "@/components/skeleton";
import {
  Avatar,
  Card,
  CardHeader,
  Chip,
  Empty,
  IconChevronLeft,
  IconChevronRight,
  buttonClass,
  cn,
} from "@/components/ui";
import { useClientData } from "@/lib/client-data";
import { formatDayDate } from "@/lib/dates";
import type { AdminAttendanceData } from "@/lib/page-data/admin-attendance";
import { STATUS_LABEL } from "@/lib/workday-constants";

export function AdminAttendance() {
  const searchParams = useSearchParams();

  // The API takes the same ?who= and ?month= the page does.
  const query = new URLSearchParams();
  const who = searchParams.get("who");
  const month = searchParams.get("month");
  if (who) query.set("who", who);
  if (month) query.set("month", month);
  const suffix = query.toString();

  const { data, error, refresh } = useClientData<AdminAttendanceData>(
    `/api/admin/attendance${suffix ? `?${suffix}` : ""}`,
  );

  if (error && !data) return <PageError message={error} onRetry={refresh} />;
  if (!data) return <PageSkeleton variant="admin" cards={3} />;

  const { today, person, people, attendance } = data;

  if (!person || !attendance) {
    return (
      <div className="flex flex-col gap-4 px-5 py-6 lg:px-8 lg:py-8">
        <h1 className="text-3xl leading-tight font-extrabold tracking-tight">
          Attendance
        </h1>
        <Card>
          <Empty
            title="Nobody to track yet"
            hint="Add the people who work here in Settings first."
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-5 py-6 lg:px-8 lg:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="font-mono text-xs tracking-widest text-muted uppercase">
            {person.name} · {data.monthLabel}
          </p>
          <h1 className="text-3xl leading-tight font-extrabold tracking-tight">
            Attendance
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/admin/attendance?who=${person.id}&month=${data.previous.value}`}
            className={buttonClass("secondary", "sm")}
          >
            <IconChevronLeft size={16} />
            {data.previous.label}
          </Link>
          {!data.isThisMonth ? (
            <Link
              href={`/admin/attendance?who=${person.id}`}
              title="Back to the month we are in"
              className={buttonClass("secondary", "sm")}
            >
              Back to {data.currentMonthName}
            </Link>
          ) : null}
          <Link
            href={`/admin/attendance?who=${person.id}&month=${data.next.value}`}
            className={buttonClass("secondary", "sm")}
          >
            {data.next.label}
            <IconChevronRight size={16} />
          </Link>
        </div>
      </header>

      {/* Whose attendance. Only shown once there is more than one person. */}
      {people.length > 1 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="label mr-1">Whose days</span>
          {people.map((member) => (
            <Link
              key={member.id}
              href={`/admin/attendance?who=${member.id}&month=${data.monthValue}`}
              aria-current={member.id === person.id ? "page" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold transition-colors",
                member.id === person.id
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-line bg-surface text-ink-2 hover:bg-surface-2",
              )}
            >
              <Avatar name={member.name} role={member.role} size="sm" />
              {member.name}
            </Link>
          ))}
        </div>
      ) : null}

      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <span className="label">{data.monthLabel}</span>
          <span className="text-[13px] text-muted">{data.countNote}</span>
        </div>
        <AttendanceTally attendance={attendance} showScheduled />
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] xl:items-start">
        <Card className="p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="label">Click a day to record it</span>
            <div className="flex flex-wrap gap-1.5">
              <Chip tone="accent">Worked</Chip>
              <Chip>Off</Chip>
              <Chip tone="danger">Sick</Chip>
              <Chip tone="lock">Leave</Chip>
            </div>
          </div>
          <AttendanceCalendar weeks={data.weeks} />
        </Card>

        <div className="flex flex-col gap-5">
          <Card className="p-5">
            <div className="mb-4 flex flex-col gap-1">
              <span className="label">Record a run of days</span>
              <p className="text-[13px] text-ink-2">
                For leave booked ahead: pick the first and last day, choose what
                to record, and save. The dates need not be in this month.
              </p>
            </div>
            <AttendanceRangeForm
              key={`${person.id}:${data.monthStart}`}
              userId={person.id}
              defaultFrom={data.rangeDefault}
              defaultTo={data.rangeDefault}
            />
          </Card>

          <Card>
            <CardHeader title={`Recorded in ${data.monthLabel}`} />
            {attendance.exceptions.length === 0 ? (
              <p className="px-5 pt-1 pb-5 text-sm text-muted">
                Nothing out of the ordinary this month.
              </p>
            ) : (
              <ul className="flex flex-col gap-2 px-5 pt-1 pb-5">
                {attendance.exceptions.map((entry) => (
                  <li
                    key={entry.date}
                    className="flex flex-wrap items-center gap-2 border-b border-line pb-2 text-sm last:border-b-0 last:pb-0"
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
                      <span className="text-xs text-muted">still to come</span>
                    ) : null}
                    {entry.note ? (
                      <span className="min-w-0 flex-1 text-ink-2">
                        {entry.note}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
