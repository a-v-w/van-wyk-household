import type { Metadata } from "next";
import Link from "next/link";
import { Card, Chip, Empty, IconBook } from "@/components/ui";
import { requireViewer } from "@/lib/auth";
import {
  formatDate,
  formatDayNumber,
  isoWeek,
  shiftDate,
  startOfIsoWeek,
  todayIn,
  weekdayShort,
  type IsoDate,
} from "@/lib/dates";
import { groupBySlot, loadMeals, SLOT_LABEL } from "@/lib/meals";
import { loadWorkdayCalendar } from "@/lib/workdays";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Menu" };

export default async function MenuPage() {
  const viewer = await requireViewer();
  const { household } = viewer;
  const today = todayIn(household.timezone);

  const thisMonday = startOfIsoWeek(today);
  const nextMonday = shiftDate(thisMonday, 7);
  const from = thisMonday;
  const to = shiftDate(nextMonday, 6);

  const calendar = await loadWorkdayCalendar(household, from, to);
  const meals = await loadMeals(household.id, from, to, calendar);

  const weeks: { monday: IsoDate; label: string }[] = [
    { monday: thisMonday, label: "This week" },
    { monday: nextMonday, label: "Next week" },
  ];

  return (
    <div className="flex flex-col gap-6 px-4 pt-2 pb-8">
      <header className="flex flex-col gap-1 px-1">
        <p className="font-mono text-xs tracking-widest text-muted uppercase">
          Lunch and dinner
        </p>
        <h1 className="text-[28px] leading-tight font-extrabold tracking-tight">
          Menu
        </h1>
      </header>

      {weeks.map((week) => {
        const dates = isoWeek(week.monday);
        const planned = dates.filter(
          (date) => groupBySlot(meals, date).length > 0,
        );

        return (
          <section key={week.monday} className="flex flex-col gap-2">
            <div className="flex items-baseline gap-2 px-1">
              <h2 className="label">{week.label}</h2>
              <span className="font-mono text-xs text-muted">
                {formatDate(week.monday)}
              </span>
            </div>

            {planned.length === 0 ? (
              <Card>
                <Empty title="No menu yet for this week" />
              </Card>
            ) : (
              <div className="flex flex-col gap-2">
                {planned.map((date) => (
                  <Card key={date} className="overflow-hidden">
                    <div className="flex items-center gap-2 border-b border-line bg-surface-2 px-4 py-2">
                      <span className="label">{weekdayShort(date)}</span>
                      <span className="font-mono text-sm font-semibold tabular">
                        {formatDayNumber(date)}
                      </span>
                      {date === today ? (
                        <Chip tone="accent" className="ml-auto">
                          Today
                        </Chip>
                      ) : !calendar.isWorking(date) ? (
                        <span className="ml-auto text-xs text-muted">
                          Not a working day
                        </span>
                      ) : null}
                    </div>

                    {/* Slots with nothing planned are left out entirely. */}
                    {groupBySlot(meals, date).map((group) => (
                      <div
                        key={group.slot}
                        className="border-b border-line last:border-b-0"
                      >
                        <div className="label px-4 pt-2.5 pb-1">
                          {SLOT_LABEL[group.slot]}
                        </div>
                        <ul>
                          {group.entries.map((meal) => (
                            <li
                              key={meal.id}
                              className="flex flex-col gap-1 px-4 pt-1 pb-3"
                            >
                              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                                <span className="text-[15px] leading-snug font-bold">
                                  {meal.dish}
                                </span>
                                {meal.forWhom ? (
                                  <Chip tone="accent">for {meal.forWhom}</Chip>
                                ) : null}
                              </div>
                              {meal.notes ? (
                                <span className="text-[13px] leading-snug text-ink-2">
                                  {meal.notes}
                                </span>
                              ) : null}
                              {meal.recipeId ? (
                                <Link
                                  href={`/recipes/${meal.recipeId}`}
                                  className="inline-flex items-center gap-1 self-start rounded-full border border-accent-line bg-accent-soft px-2.5 py-0.5 text-xs font-bold text-accent"
                                >
                                  <IconBook size={13} />
                                  Recipe
                                </Link>
                              ) : null}
                              <div className="flex flex-wrap gap-1.5">
                                {meal.prepTiming === "day_before" ? (
                                  <Chip>
                                    Prep on {weekdayShort(meal.prepDate)}{" "}
                                    {formatDayNumber(meal.prepDate)}
                                  </Chip>
                                ) : (
                                  <Chip>Make on the day</Chip>
                                )}
                                {meal.prepDone ? (
                                  <Chip tone="ok">Done</Chip>
                                ) : null}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </Card>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
