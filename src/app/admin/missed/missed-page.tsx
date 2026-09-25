"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageError, PageSkeleton } from "@/components/skeleton";
import { TaskRow } from "@/components/task-list";
import { Avatar, Card, Chip, Empty, cn } from "@/components/ui";
import { useClientData } from "@/lib/client-data";
import type { AdminMissedData } from "@/lib/page-data/admin-missed";

function href(who: number | null, days: number): string {
  const query = new URLSearchParams();
  if (who) query.set("who", String(who));
  if (days !== 14) query.set("days", String(days));
  const qs = query.toString();
  return qs ? `/admin/missed?${qs}` : "/admin/missed";
}

const chipClass = (on: boolean) =>
  cn(
    "rounded-full border px-3 py-1 text-xs font-bold transition-colors",
    on
      ? "border-accent bg-accent-soft text-accent"
      : "border-line bg-surface text-ink-2 hover:bg-surface-2",
  );

export function AdminMissedPage() {
  const searchParams = useSearchParams();
  const whoParam = searchParams.get("who");
  const whoId = whoParam ? Number(whoParam) : null;
  const days = Number(searchParams.get("days")) || 14;

  const { data, error, refresh } = useClientData<AdminMissedData>(
    href(whoId, days).replace("/admin/missed", "/api/admin/missed"),
  );

  if (error && !data) return <PageError message={error} onRetry={refresh} />;
  if (!data) return <PageSkeleton variant="admin" cards={2} />;

  const everyone = data.people.reduce((sum, p) => sum + p.missed, 0);

  return (
    <div className="flex flex-col gap-5 px-5 py-6 lg:px-8 lg:py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl leading-tight font-extrabold tracking-tight">
          Missed
        </h1>
        <p className="text-sm text-ink-2">
          Due before today and never ticked, back to {data.sinceLabel}. Tick one
          off if it was done after all, or mark it as not needed to clear it.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <span className="label mr-1">Who</span>
        <Link href={href(null, data.days)} className={chipClass(!data.who)}>
          Everyone {everyone > 0 ? `(${everyone})` : ""}
        </Link>
        {data.people.map((person) => (
          <Link
            key={person.id}
            href={href(person.id, data.days)}
            className={cn(chipClass(data.who === person.id), "inline-flex items-center gap-1.5")}
          >
            <Avatar name={person.name} role={person.role} size="sm" />
            {person.name}
            {person.missed > 0 ? ` (${person.missed})` : ""}
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="label mr-1">Going back</span>
        {data.windows.map((window) => (
          <Link
            key={window}
            href={href(data.who, window)}
            className={chipClass(data.days === window)}
          >
            {window} days
          </Link>
        ))}
      </div>

      {data.total === 0 ? (
        <Card>
          <Empty
            title="Nothing missed"
            hint={`Everything due since ${data.sinceLabel} has been ticked off.`}
          />
        </Card>
      ) : (
        data.groups.map((day) => (
          <section key={day.date} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <h2 className="label">{day.heading}</h2>
              <span className="font-mono text-xs text-muted">{day.ago}</span>
              <Chip tone="danger" className="ml-auto">
                {day.rows.length}
              </Chip>
            </div>
            <Card>
              <ul>
                {day.rows.map((row) => (
                  <TaskRow key={`${row.taskId}:${row.date}`} row={row} />
                ))}
              </ul>
            </Card>
          </section>
        ))
      )}
    </div>
  );
}
