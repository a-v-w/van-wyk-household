import "server-only";

import { and, eq } from "drizzle-orm";
import { Resend } from "resend";
import { db } from "@/db";
import {
  notificationLog,
  type GroceryItem,
  type GroceryList,
  type Household,
  type User,
} from "@/db/schema";
import { formatDate, type IsoDate } from "@/lib/dates";

export type NotificationKind =
  | "employee_grocery_reminder"
  | "admin_order_reminder";

/**
 * Records that a reminder went out. Returns false when one already has, so a
 * re-run of the cron is harmless.
 */
export async function claimNotification(
  householdId: number,
  kind: NotificationKind,
  sentForDate: IsoDate,
  recipientUserId: number,
  listId: number,
): Promise<boolean> {
  const existing = await db.query.notificationLog.findFirst({
    where: and(
      eq(notificationLog.kind, kind),
      eq(notificationLog.sentForDate, sentForDate),
      eq(notificationLog.recipientUserId, recipientUserId),
      eq(notificationLog.listId, listId),
    ),
  });
  if (existing) return false;

  const inserted = await db
    .insert(notificationLog)
    .values({ householdId, kind, sentForDate, recipientUserId, listId })
    .onConflictDoNothing({
      target: [
        notificationLog.kind,
        notificationLog.sentForDate,
        notificationLog.recipientUserId,
        notificationLog.listId,
      ],
    })
    .returning();

  return inserted.length > 0;
}

function client(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

export async function sendEmail(
  to: string,
  subject: string,
  text: string,
): Promise<{ sent: boolean; reason?: string }> {
  const resend = client();
  const from = process.env.NOTIFY_FROM_EMAIL;

  if (!resend || !from) {
    // Not configured yet; the in-app banner still does the job.
    return { sent: false, reason: "email is not configured" };
  }

  try {
    await resend.emails.send({ from, to, subject, text });
    return { sent: true };
  } catch (error) {
    return {
      sent: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

/* ---------------------------------------------------------------- bodies -- */

export function lockReminderEmail(
  household: Household,
  list: GroceryList,
  person: User,
  orderDate: IsoDate | null,
  itemCount: number,
  lockTime: string,
): { subject: string; text: string } {
  const first = person.name.split(/\s+/)[0];
  return {
    subject: `${list.name} closes at ${lockTime.slice(0, 5)} today`,
    text: [
      `Hi ${first},`,
      "",
      orderDate
        ? `Today is the last day to add to the ${list.name.toLowerCase()} for the order on ${formatDate(orderDate)}.`
        : `Today is the last day to add to the ${list.name.toLowerCase()}.`,
      `It closes at ${lockTime.slice(0, 5)} and has ${itemCount} ${itemCount === 1 ? "item" : "items"} on it so far.`,
      "",
      "Open the app and add anything the house is running low on.",
      "",
      household.name,
    ].join("\n"),
  };
}

export function orderReminderEmail(
  household: Household,
  list: GroceryList,
  person: User,
  orderDate: IsoDate | null,
  items: GroceryItem[],
): { subject: string; text: string } {
  const first = person.name.split(/\s+/)[0];
  const pending = items.filter((i) => i.status === "pending");
  const carried = pending.filter((i) => i.carryCount > 0);

  const lines = [
    `Hi ${first},`,
    "",
    orderDate
      ? `The ${list.name.toLowerCase()} for ${formatDate(orderDate)} is closed: ${pending.length} ${pending.length === 1 ? "item" : "items"} to order.`
      : `The ${list.name.toLowerCase()} has ${pending.length} ${pending.length === 1 ? "item" : "items"} waiting.`,
  ];

  if (carried.length > 0) {
    lines.push(
      `${carried.length} of those were carried over because they were out of stock last time.`,
    );
  }

  lines.push("");

  if (carried.length > 0) {
    lines.push("Carried over:");
    for (const item of carried) {
      lines.push(`- ${item.name}${item.quantity ? ` (${item.quantity})` : ""}`);
    }
    lines.push("");
  }

  const rest = pending.filter((i) => i.carryCount === 0);
  if (rest.length > 0) {
    lines.push("The rest:");
    for (const item of rest) {
      lines.push(`- ${item.name}${item.quantity ? ` (${item.quantity})` : ""}`);
    }
    lines.push("");
  }

  lines.push("Mark each one ordered, out of stock or not needed in the app.");
  lines.push("");
  lines.push(household.name);

  return {
    subject: `${list.name}: ${pending.length} ${pending.length === 1 ? "item" : "items"} to order today`,
    text: lines.join("\n"),
  };
}
