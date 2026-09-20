"use client";

import Link from "next/link";
import { PageError, PageSkeleton } from "@/components/skeleton";
import { Card, Chip, Empty, IconBook } from "@/components/ui";
import { useClientData } from "@/lib/client-data";
import type { MenuData } from "@/lib/page-data/menu";

export function MenuPage() {
  const { data, error, refresh } = useClientData<MenuData>("/api/menu");

  if (error && !data) return <PageError message={error} onRetry={refresh} />;
  if (!data) return <PageSkeleton variant="employee" cards={2} />;

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

      {data.weeks.map((week) => (
        <section key={week.monday} className="flex flex-col gap-2">
          <div className="flex items-baseline gap-2 px-1">
            <h2 className="label">{week.label}</h2>
            <span className="font-mono text-xs text-muted">
              {week.dateLabel}
            </span>
          </div>

          {week.days.length === 0 ? (
            <Card>
              <Empty title="No menu yet for this week" />
            </Card>
          ) : (
            <div className="flex flex-col gap-2">
              {week.days.map((day) => (
                <Card key={day.date} className="overflow-hidden">
                  <div className="flex items-center gap-2 border-b border-line bg-surface-2 px-4 py-2">
                    <span className="label">{day.weekday}</span>
                    <span className="font-mono text-sm font-semibold tabular">
                      {day.dayNumber}
                    </span>
                    {day.isToday ? (
                      <Chip tone="accent" className="ml-auto">
                        Today
                      </Chip>
                    ) : !day.working ? (
                      <span className="ml-auto text-xs text-muted">
                        Not a working day
                      </span>
                    ) : null}
                  </div>

                  {/* Slots with nothing planned are left out entirely. */}
                  {day.slots.map((group) => (
                    <div
                      key={group.slot}
                      className="border-b border-line last:border-b-0"
                    >
                      <div className="label px-4 pt-2.5 pb-1">{group.label}</div>
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
                              <Chip>{meal.prepLabel}</Chip>
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
      ))}
    </div>
  );
}
