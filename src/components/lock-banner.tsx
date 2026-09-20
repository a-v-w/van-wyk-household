import Link from "next/link";
import { IconArrowRight, IconLock } from "@/components/ui";
import { countdown, formatDate, type IsoDate } from "@/lib/dates";

/**
 * The lock-day nudge. It only appears on the day a list closes, and counts
 * down to the minute so there is no guessing how long is left.
 */
export function LockBanner({
  listName,
  locksAt,
  timeLabel,
  orderDate,
  itemCount,
  href = "/groceries",
}: {
  listName: string;
  /** The lock instant, as ISO. */
  locksAt: string;
  /** The lock time in the household zone, e.g. "17:00". */
  timeLabel: string;
  orderDate: IsoDate | null;
  itemCount: number;
  href?: string;
}) {
  const left = countdown(new Date(locksAt));

  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl border border-lock-line bg-lock-soft px-4 py-3.5 transition-opacity hover:opacity-90"
    >
      <IconLock size={22} className="flex-none text-lock" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-extrabold text-lock">
          {listName} closes today at {timeLabel}
        </span>
        <span className="text-[13px] leading-snug text-lock">
          {orderDate
            ? `Add anything you need for the order on ${formatDate(orderDate)}. `
            : "Add anything you need before it closes. "}
          <span className="font-mono font-semibold tabular">{left}</span> left,
          and {itemCount} {itemCount === 1 ? "item" : "items"} on it so far.
        </span>
      </div>
      <IconArrowRight size={20} className="flex-none text-lock" />
    </Link>
  );
}
