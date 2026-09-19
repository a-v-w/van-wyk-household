import { TZDate } from "@date-fns/tz";
import { addDays, addMonths, format, parseISO } from "date-fns";

/**
 * Calendar dates are plain `YYYY-MM-DD` strings everywhere in this app, which
 * is also what the Postgres `date` columns hand back. Anything that needs a
 * real instant (the grocery lock, "now") is computed in the household's
 * timezone, never in UTC and never in the server's zone.
 */
export type IsoDate = string;

export const WEEKDAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const WEEKDAY_INITIAL = ["M", "T", "W", "T", "F", "S", "S"];

/** The current instant, as seen in the given timezone. */
export function nowInZone(timezone: string): TZDate {
  return TZDate.tz(timezone);
}

/** Today's calendar date in the given timezone. */
export function todayIn(timezone: string): IsoDate {
  return format(nowInZone(timezone), "yyyy-MM-dd");
}

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export function isoWeekday(date: IsoDate): number {
  const day = parseISO(date).getDay();
  return day === 0 ? 7 : day;
}

export function shiftDate(date: IsoDate, days: number): IsoDate {
  return format(addDays(parseISO(date), days), "yyyy-MM-dd");
}

export function shiftMonths(date: IsoDate, months: number): IsoDate {
  return format(addMonths(parseISO(date), months), "yyyy-MM-dd");
}

/** The Monday of the week containing `date`. */
export function startOfIsoWeek(date: IsoDate): IsoDate {
  return shiftDate(date, -(isoWeekday(date) - 1));
}

/** Seven dates, Monday through Sunday, for the week containing `date`. */
export function isoWeek(date: IsoDate): IsoDate[] {
  const monday = startOfIsoWeek(date);
  return Array.from({ length: 7 }, (_, i) => shiftDate(monday, i));
}

/** Every date from `from` to `to` inclusive. */
export function datesBetween(from: IsoDate, to: IsoDate): IsoDate[] {
  const out: IsoDate[] = [];
  for (let d = from; d <= to; d = shiftDate(d, 1)) out.push(d);
  return out;
}

export function daysBetween(from: IsoDate, to: IsoDate): number {
  const ms = parseISO(to).getTime() - parseISO(from).getTime();
  return Math.round(ms / 86_400_000);
}

/**
 * The instant at which `time` ("18:00" or "18:00:00") occurs on `date` in the
 * given timezone, as a real Date.
 */
export function instantAt(
  date: IsoDate,
  time: string,
  timezone: string,
): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh = 0, mm = 0, ss = 0] = time.split(":").map(Number);
  return new Date(
    new TZDate(y, m - 1, d, hh, mm, ss, timezone).getTime(),
  );
}

/* ------------------------------------------------------------ formatting -- */

export function formatDate(date: IsoDate): string {
  return format(parseISO(date), "d MMM yyyy");
}

export function formatDayDate(date: IsoDate): string {
  return format(parseISO(date), "EEE d MMM");
}

export function formatLongDate(date: IsoDate): string {
  return format(parseISO(date), "EEEE d MMMM");
}

export function formatDayNumber(date: IsoDate): string {
  return format(parseISO(date), "d");
}

export function formatMonth(date: IsoDate): string {
  return format(parseISO(date), "MMMM yyyy");
}

export function formatMonthShort(date: IsoDate): string {
  return format(parseISO(date), "MMM yyyy");
}

/** The first date of the month containing `date`. */
export function startOfMonth(date: IsoDate): IsoDate {
  return `${date.slice(0, 7)}-01`;
}

/** The last date of the month containing `date`. */
export function endOfMonth(date: IsoDate): IsoDate {
  const [year, month] = date.split("-").map(Number);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${date.slice(0, 7)}-${String(last).padStart(2, "0")}`;
}

/** The first of the month `months` away from the one containing `date`. */
export function shiftMonthStart(date: IsoDate, months: number): IsoDate {
  const [year, month] = date.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  return target.toISOString().slice(0, 10);
}

/**
 * The weeks of a month as Monday-first rows, padded with the neighbouring
 * dates so every row has seven days.
 */
export function monthGrid(date: IsoDate): IsoDate[][] {
  const first = startOfMonth(date);
  const last = endOfMonth(date);
  const start = shiftDate(first, -(isoWeekday(first) - 1));
  const end = shiftDate(last, 7 - isoWeekday(last));

  const weeks: IsoDate[][] = [];
  for (let cursor = start; cursor <= end; cursor = shiftDate(cursor, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => shiftDate(cursor, i)));
  }
  return weeks;
}

/** "YYYY-MM" for a month picker input. */
export function monthValue(date: IsoDate): string {
  return date.slice(0, 7);
}

export function weekdayName(date: IsoDate): string {
  return WEEKDAY_NAMES[isoWeekday(date) - 1];
}

export function weekdayShort(date: IsoDate): string {
  return WEEKDAY_SHORT[isoWeekday(date) - 1];
}

/** "17:30:00" -> "17:30". Empty for a null time. */
export function formatTime(time: string | null): string {
  if (!time) return "";
  return time.slice(0, 5);
}

/** "Today", "Tomorrow", "Yesterday" or a short date, relative to `today`. */
export function relativeDay(date: IsoDate, today: IsoDate): string {
  const diff = daysBetween(today, date);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return formatDayDate(date);
}

/** A rough "7h 40m" style countdown from now until `target`. */
export function countdown(target: Date, from: Date = new Date()): string {
  const ms = target.getTime() - from.getTime();
  if (ms <= 0) return "0m";
  const totalMinutes = Math.floor(ms / 60_000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
