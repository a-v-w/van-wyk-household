import { eq } from "drizzle-orm";
import { db } from "@/db";
import { households } from "@/db/schema";
import { isoWeekday, todayIn } from "@/lib/dates";
import {
  claimNotification,
  lockReminderEmail,
  orderReminderEmail,
  sendEmail,
} from "@/lib/notify";
import {
  currentCycle,
  currentLockDate,
  cyclesAwaitingOrder,
  loadCycleView,
} from "@/lib/groceries";
import { householdMembers } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * One cron hit a day (Vercel Cron, 07:00 UTC = 09:00 SAST). It works out the
 * weekday in each household's own timezone and sends whichever reminder is due,
 * so the schedule can move in Settings without touching the deploy.
 *
 * Every send is claimed in `notification_log` first, so re-running this is safe.
 */
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const header = request.headers.get("authorization");
    if (header !== `Bearer ${secret}`) {
      return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  const all = await db.query.households.findMany();
  const results: unknown[] = [];

  for (const household of all) {
    results.push(await runFor(household.id));
  }

  return Response.json({ ok: true, households: results });
}

async function runFor(householdId: number) {
  const household = await db.query.households.findFirst({
    where: eq(households.id, householdId),
  });
  if (!household) return { householdId, skipped: "not found" };

  const today = todayIn(household.timezone);
  const weekday = isoWeekday(today);
  const members = await householdMembers(household.id);
  const sent: string[] = [];

  // Lock day: nudge everyone who is not the admin to get their items in.
  if (currentLockDate(household) === today) {
    const cycle = await currentCycle(household);
    const view = await loadCycleView(cycle);
    const count = view.items.filter((i) => i.status === "pending").length;

    for (const person of members.filter((m) => m.role === "employee")) {
      const fresh = await claimNotification(
        household.id,
        "employee_grocery_reminder",
        today,
        person.id,
      );
      if (!fresh) continue;

      const mail = lockReminderEmail(
        household,
        person,
        cycle.orderDate,
        count,
        household.groceryLockTime,
      );
      const outcome = await sendEmail(person.email, mail.subject, mail.text);
      sent.push(`lock reminder to ${person.name}: ${outcome.sent ? "sent" : outcome.reason}`);
    }
  }

  // Order day: tell the admin what is waiting, carried-over items called out.
  if (weekday === household.groceryOrderWeekday) {
    const awaiting = await cyclesAwaitingOrder(household);
    const cycle = awaiting[0];

    if (cycle) {
      const view = await loadCycleView(cycle);
      for (const person of members.filter((m) => m.role === "admin")) {
        const fresh = await claimNotification(
          household.id,
          "admin_order_reminder",
          today,
          person.id,
        );
        if (!fresh) continue;

        const mail = orderReminderEmail(
          household,
          person,
          cycle.orderDate,
          view.items,
        );
        const outcome = await sendEmail(person.email, mail.subject, mail.text);
        sent.push(
          `order reminder to ${person.name}: ${outcome.sent ? "sent" : outcome.reason}`,
        );
      }
    }
  }

  return { householdId, today, sent };
}
