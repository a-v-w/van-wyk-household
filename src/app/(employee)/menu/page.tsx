import type { Metadata } from "next";
import { Card, Chip, Empty } from "@/components/ui";
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
import { loadMeals, SLOTS, SLOT_LABEL, type MealWithPrep } from "@/lib/meals";
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
        const weekMeals = meals.filter(
          (m) => m.date >= week.monday && m.date <= shiftDate(week.monday, 6),
        );

        return (
          <section key={week.monday} className="flex flex-col gap-2">
            <div className="flex items-baseline gap-2 px-1">
              <h2 className="label">{week.label}</h2>
              <span className="font-mono text-xs text-muted">
                {formatDate(week.monday)}
              </span>
            </div>

            {weekMeals.length === 0 ? (
              <Card>
                <Empty title="No menu yet for this week" />
              </Card>
            ) : (
              <div className="flex flex-col gap-2">
                {dates.map((date) => {
                  const dayMeals = SLOTS.map((slot) =>
                    weekMeals.find((m) => m.date === date && m.slot === slot),
                  ).filter(Boolean) as MealWithPrep[];
                  if (dayMeals.length === 0) return null;

                  return (
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
                      <ul>
                        {dayMeals.map((meal) => (
                          <li
                            key={meal.id}
                            className="flex items-start gap-3 border-b border-line px-4 py-3 last:border-b-0"
                          >
                            <span className="label w-14 flex-none pt-0.5">
                              {SLOT_LABEL[meal.slot]}
                            </span>
                            <div className="flex min-w-0 flex-1 flex-col gap-1">
                              <span className="text-[15px] leading-snug font-bold">
                                {meal.dish}
                              </span>
                              {meal.notes ? (
                                <span className="text-[13px] leading-snug text-ink-2">
                                  {meal.notes}
                                </span>
                              ) : null}
                              <div className="flex flex-wrap gap-1.5">
                                {meal.prepTiming === "day_before" ? (
                                  <Chip tone="accent">
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
                            </div>
                          </li>
                        ))}
                      </ul>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
