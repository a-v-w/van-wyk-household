import type { Attendance } from "@/lib/workdays";

/** One number in the attendance row. */
function Tally({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint?: string;
  tone?: "accent" | "danger" | "lock";
}) {
  const colour =
    tone === "danger"
      ? "text-danger"
      : tone === "lock"
        ? "text-lock"
        : tone === "accent"
          ? "text-accent"
          : "text-ink";

  return (
    <div className="flex flex-col gap-0.5 rounded-lg bg-surface-2 px-3 py-2.5">
      <span
        className={`font-mono text-2xl leading-none font-bold tabular ${colour}`}
      >
        {value}
      </span>
      <span className="text-xs font-semibold text-ink-2">{label}</span>
      {hint ? <span className="text-[11px] text-muted">{hint}</span> : null}
    </div>
  );
}

/** The month's counts, used on the dashboard and on the attendance page. */
export function AttendanceTally({
  attendance,
  showScheduled = false,
}: {
  attendance: Attendance;
  showScheduled?: boolean;
}) {
  return (
    <div
      className={`grid grid-cols-2 gap-3 ${
        showScheduled ? "sm:grid-cols-5" : "sm:grid-cols-4"
      }`}
    >
      <Tally label="Days worked" value={attendance.worked} />
      {showScheduled ? (
        <Tally
          label="Working days"
          value={attendance.scheduled}
          hint="Across the whole month"
        />
      ) : null}
      <Tally
        label="Extra days"
        value={attendance.extra}
        hint="Outside the usual weekdays"
        tone={attendance.extra > 0 ? "accent" : undefined}
      />
      <Tally
        label="Sick"
        value={attendance.sick}
        tone={attendance.sick > 0 ? "danger" : undefined}
      />
      <Tally
        label="Leave"
        value={attendance.leave}
        tone={attendance.leave > 0 ? "lock" : undefined}
      />
    </div>
  );
}
