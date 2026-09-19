import { StatTile } from "@/components/ui";
import type { Attendance } from "@/lib/workdays";

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
      <StatTile label="Days worked" value={attendance.worked} />
      {showScheduled ? (
        <StatTile
          label="Working days"
          value={attendance.scheduled}
          hint="Across the whole month"
        />
      ) : null}
      <StatTile
        label="Extra days"
        value={attendance.extra}
        hint="Outside the usual weekdays"
        tone={attendance.extra > 0 ? "accent" : undefined}
      />
      <StatTile
        label="Sick"
        value={attendance.sick}
        tone={attendance.sick > 0 ? "danger" : undefined}
      />
      <StatTile
        label="Leave"
        value={attendance.leave}
        tone={attendance.leave > 0 ? "lock" : undefined}
      />
    </div>
  );
}
