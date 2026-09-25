"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import {
  archiveTask,
  saveTask,
  type TaskFormState,
} from "@/app/actions/tasks";
import {
  Avatar,
  Field,
  buttonClass,
  cn,
  inputClass,
} from "@/components/ui";
import { invalidateData } from "@/lib/client-data";
import { WEEKDAY_INITIAL, WEEKDAY_NAMES, WEEKDAY_SHORT } from "@/lib/dates";

export type EditorPerson = { id: number; name: string; role: "admin" | "employee" };

export type TaskEditorValues = {
  id: number | null;
  title: string;
  notes: string;
  kind: "once" | "recurring";
  assignedTo: number;
  timeOfDay: string;
  workingDaysOnly: boolean;
  frequency: "daily" | "weekly" | "monthly";
  interval: number;
  weekdays: number[];
  monthDay: number;
  monthlyMode: "day_of_month" | "weekday_of_month";
  /** 1–4, or -1 for the last one. */
  monthWeek: number;
  monthWeekday: number;
  dueDate: string;
  startDate: string;
  endDate: string;
};

export function TaskEditor({
  values,
  people,
  currentUserId,
  previewDates,
}: {
  values: TaskEditorValues;
  people: EditorPerson[];
  currentUserId: number;
  previewDates: string[];
}) {
  const router = useRouter();
  const [state, action, saving] = useActionState<TaskFormState, FormData>(
    async (previous, formData) => {
      const result = await saveTask(previous, formData);
      invalidateData();
      return result;
    },
    undefined,
  );
  const [archiving, startArchive] = useTransition();

  const [kind, setKind] = useState(values.kind);
  const [frequency, setFrequency] = useState(values.frequency);
  const [weekdays, setWeekdays] = useState<number[]>(values.weekdays);
  const [monthlyMode, setMonthlyMode] = useState(values.monthlyMode);
  const [assignedTo, setAssignedTo] = useState(values.assignedTo);

  useEffect(() => {
    if (state?.ok) router.push("/admin/tasks");
  }, [state, router]);

  function toggleWeekday(day: number) {
    setWeekdays((current) =>
      current.includes(day)
        ? current.filter((d) => d !== day)
        : [...current, day].sort((a, b) => a - b),
    );
  }

  return (
    <form action={action} className="flex flex-col gap-5">
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}

      <Field label="Title">
        <input
          id="title"
          name="title"
          required
          defaultValue={values.title}
          placeholder="Wash and fold the laundry"
          className={inputClass}
        />
      </Field>

      <Field label="Notes" hint="Anything useful: where things go, how to do it.">
        <textarea
          id="notes"
          name="notes"
          rows={2}
          defaultValue={values.notes}
          className={cn(inputClass, "resize-y")}
        />
      </Field>

      <Field label="Who it is for">
        <div className="flex gap-2">
          {people.map((person) => (
            <label
              key={person.id}
              className={cn(
                "flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold transition-colors",
                assignedTo === person.id
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-line-strong bg-surface text-ink-2 hover:bg-surface-2",
              )}
            >
              <input
                type="radio"
                name="assignedTo"
                value={person.id}
                checked={assignedTo === person.id}
                onChange={() => setAssignedTo(person.id)}
                className="sr-only"
              />
              <Avatar name={person.name} role={person.role} size="sm" />
              {person.id === currentUserId ? "Me" : person.name}
            </label>
          ))}
        </div>
      </Field>

      <Field label="Repeats">
        <div className="flex overflow-hidden rounded-lg border border-line-strong">
          {(["once", "recurring"] as const).map((option) => (
            <label
              key={option}
              className={cn(
                "flex-1 cursor-pointer py-2 text-center text-sm font-bold transition-colors",
                kind === option
                  ? "bg-accent text-accent-ink"
                  : "bg-surface text-ink-2 hover:bg-surface-2",
              )}
            >
              <input
                type="radio"
                name="kind"
                value={option}
                checked={kind === option}
                onChange={() => setKind(option)}
                className="sr-only"
              />
              {option === "once" ? "Just once" : "On a schedule"}
            </label>
          ))}
        </div>
      </Field>

      {kind === "once" ? (
        <Field label="Date">
          <input
            id="dueDate"
            type="date"
            name="dueDate"
            defaultValue={values.dueDate}
            className={inputClass}
          />
        </Field>
      ) : (
        <>
          <Field label="How often">
            <div className="flex overflow-hidden rounded-lg border border-line-strong">
              {(["daily", "weekly", "monthly"] as const).map((option) => (
                <label
                  key={option}
                  className={cn(
                    "flex-1 cursor-pointer py-2 text-center text-sm font-bold capitalize transition-colors",
                    frequency === option
                      ? "bg-accent text-accent-ink"
                      : "bg-surface text-ink-2 hover:bg-surface-2",
                  )}
                >
                  <input
                    type="radio"
                    name="frequency"
                    value={option}
                    checked={frequency === option}
                    onChange={() => setFrequency(option)}
                    className="sr-only"
                  />
                  {option}
                </label>
              ))}
            </div>
          </Field>

          {frequency === "weekly" ? (
            <Field
              label="On these days"
              hint="Weekend days only count when they are marked as working days."
            >
              <div className="flex gap-2">
                {WEEKDAY_INITIAL.map((initial, index) => {
                  const day = index + 1;
                  const on = weekdays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleWeekday(day)}
                      aria-pressed={on}
                      aria-label={WEEKDAY_SHORT[index]}
                      className={cn(
                        "h-10 w-10 cursor-pointer rounded-full border text-xs font-extrabold transition-colors",
                        on
                          ? "border-accent bg-accent text-accent-ink"
                          : day >= 6
                            ? "border-dashed border-line-strong text-muted hover:bg-surface-2"
                            : "border-line-strong bg-surface text-ink-2 hover:bg-surface-2",
                      )}
                    >
                      {initial}
                    </button>
                  );
                })}
              </div>
              {weekdays.map((day) => (
                <input key={day} type="hidden" name="weekdays" value={day} />
              ))}
            </Field>
          ) : null}

          {frequency === "monthly" ? (
            <Field
              label="Which day"
              hint="A date stays put; a weekday moves with the month, so the last Thursday is the 4th one some months and the 5th in others."
            >
              <div className="flex flex-col gap-3">
                <div className="flex overflow-hidden rounded-lg border border-line-strong">
                  {(
                    [
                      ["day_of_month", "A date"],
                      ["weekday_of_month", "A weekday"],
                    ] as const
                  ).map(([option, label]) => (
                    <label
                      key={option}
                      className={cn(
                        "flex-1 cursor-pointer py-2 text-center text-sm font-bold transition-colors",
                        monthlyMode === option
                          ? "bg-accent text-accent-ink"
                          : "bg-surface text-ink-2 hover:bg-surface-2",
                      )}
                    >
                      <input
                        type="radio"
                        name="monthlyMode"
                        value={option}
                        checked={monthlyMode === option}
                        onChange={() => setMonthlyMode(option)}
                        className="sr-only"
                      />
                      {label}
                    </label>
                  ))}
                </div>

                {monthlyMode === "day_of_month" ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <label htmlFor="monthDay" className="text-sm text-ink-2">
                      On the
                    </label>
                    <input
                      id="monthDay"
                      type="number"
                      name="monthDay"
                      min={1}
                      max={31}
                      defaultValue={values.monthDay}
                      className={cn(inputClass, "max-w-24")}
                    />
                    <span className="text-sm text-ink-2">of the month</span>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <label htmlFor="monthWeek" className="text-sm text-ink-2">
                      On the
                    </label>
                    <select
                      id="monthWeek"
                      name="monthWeek"
                      defaultValue={String(values.monthWeek)}
                      className={cn(inputClass, "max-w-36")}
                    >
                      <option value="1">first</option>
                      <option value="2">second</option>
                      <option value="3">third</option>
                      <option value="4">fourth</option>
                      <option value="-1">last</option>
                    </select>
                    <label htmlFor="monthWeekday" className="sr-only">
                      Weekday
                    </label>
                    <select
                      id="monthWeekday"
                      name="monthWeekday"
                      defaultValue={String(values.monthWeekday)}
                      className={cn(inputClass, "max-w-40")}
                    >
                      {WEEKDAY_NAMES.map((name, index) => (
                        <option key={name} value={index + 1}>
                          {name}
                        </option>
                      ))}
                    </select>
                    <span className="text-sm text-ink-2">of the month</span>
                  </div>
                )}
              </div>
            </Field>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={`Every (${frequency === "weekly" ? "weeks" : frequency === "monthly" ? "months" : "days"})`}>
              <input
                id="interval"
                type="number"
                name="interval"
                min={1}
                max={12}
                defaultValue={values.interval}
                className={inputClass}
              />
            </Field>
            <Field label="Time of day" hint="Optional.">
              <input
                id="timeOfDay"
                type="time"
                name="timeOfDay"
                defaultValue={values.timeOfDay}
                className={inputClass}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Starts">
              <input
                id="startDate"
                type="date"
                name="startDate"
                defaultValue={values.startDate}
                className={inputClass}
              />
            </Field>
            <Field label="Ends" hint="Leave empty to run on indefinitely.">
              <input
                id="endDate"
                type="date"
                name="endDate"
                defaultValue={values.endDate}
                className={inputClass}
              />
            </Field>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-surface-2 px-4 py-3">
            <input
              type="checkbox"
              name="workingDaysOnly"
              defaultChecked={values.workingDaysOnly}
              className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-bold">Working days only</span>
              <span className="text-xs text-ink-2">
                Skip days off. A weekend day marked as working still counts.
                {frequency === "monthly"
                  ? " On a monthly task this means a month is skipped outright when that day turns out to be leave — the preview below shows what actually happens."
                  : ""}
              </span>
            </span>
          </label>
        </>
      )}

      {kind === "once" ? (
        <Field label="Time of day" hint="Optional.">
          <input
            id="timeOfDayOnce"
            type="time"
            name="timeOfDay"
            defaultValue={values.timeOfDay}
            className={cn(inputClass, "max-w-36")}
          />
        </Field>
      ) : null}

      {previewDates.length > 0 && kind === "recurring" ? (
        <div className="flex flex-col gap-1 rounded-lg bg-accent-soft px-4 py-3">
          <span className="label text-accent">As it stands, next up</span>
          <span className="font-mono text-[13px] leading-relaxed text-ink-2">
            {previewDates.join(" · ")}
          </span>
          <span className="text-xs text-muted">
            Saving refreshes this preview.
          </span>
        </div>
      ) : null}

      {state?.error ? (
        <p
          role="alert"
          className="rounded-lg border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger"
        >
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={saving}
          className={buttonClass("primary")}
        >
          {saving ? "Saving…" : values.id ? "Save changes" : "Create task"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/tasks")}
          className={buttonClass("ghost")}
        >
          Cancel
        </button>
        {values.id ? (
          <button
            type="button"
            disabled={archiving}
            onClick={() =>
              startArchive(async () => {
                await archiveTask(values.id as number);
                invalidateData();
                router.push("/admin/tasks");
              })
            }
            className={buttonClass("danger", "md", "ml-auto")}
          >
            Archive
          </button>
        ) : null}
      </div>
    </form>
  );
}
