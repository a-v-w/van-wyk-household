"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import {
  archivePerson,
  restorePerson,
  savePerson,
  type PersonState,
} from "@/app/actions/household";
import {
  Avatar,
  Chip,
  Field,
  IconPencil,
  IconPlus,
  IconUndo,
  buttonClass,
  cn,
  inputClass,
} from "@/components/ui";

export type PersonRow = {
  id: number;
  name: string;
  email: string;
  jobTitle: string | null;
  role: "admin" | "employee";
  archived: boolean;
  isYou: boolean;
};

/**
 * The household's people. Add as many as you like; each gets their own login,
 * their own tasks and their own attendance.
 */
export function PeopleManager({ people }: { people: PersonRow[] }) {
  const [editing, setEditing] = useState<number | "new" | null>(null);

  const live = people.filter((p) => !p.archived);
  const gone = people.filter((p) => p.archived);

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-2">
        {live.map((person) => (
          <li key={person.id}>
            {editing === person.id ? (
              <PersonForm
                person={person}
                onClose={() => setEditing(null)}
                canChangeRole={!person.isYou}
              />
            ) : (
              <PersonLine person={person} onEdit={() => setEditing(person.id)} />
            )}
          </li>
        ))}
      </ul>

      {editing === "new" ? (
        <PersonForm
          person={null}
          onClose={() => setEditing(null)}
          canChangeRole
        />
      ) : (
        <div>
          <button
            type="button"
            onClick={() => setEditing("new")}
            className={buttonClass("primary")}
          >
            <IconPlus size={16} />
            Add someone
          </button>
        </div>
      )}

      {gone.length > 0 ? (
        <div className="flex flex-col gap-2 border-t border-line pt-4">
          <span className="label">No longer here</span>
          <ul className="flex flex-col gap-2">
            {gone.map((person) => (
              <li key={person.id}>
                <PersonLine
                  person={person}
                  onEdit={() => setEditing(person.id)}
                />
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">
            Their tasks and attendance are kept. They cannot sign in.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function PersonLine({
  person,
  onEdit,
}: {
  person: PersonRow;
  onEdit: () => void;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2.5",
        person.archived && "opacity-60",
        pending && "opacity-50",
      )}
    >
      <Avatar name={person.name} role={person.role} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-2 text-sm font-bold">
          {person.name}
          {person.isYou ? <Chip tone="accent">You</Chip> : null}
          {person.role === "admin" ? <Chip>Admin</Chip> : null}
          {person.jobTitle ? <Chip>{person.jobTitle}</Chip> : null}
        </span>
        <span className="truncate text-xs text-muted">{person.email}</span>
      </div>

      <button
        type="button"
        onClick={onEdit}
        className={buttonClass("secondary", "sm")}
      >
        <IconPencil size={14} />
        Edit
      </button>

      {person.archived ? (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await restorePerson(person.id);
            })
          }
          className={buttonClass("secondary", "sm")}
        >
          <IconUndo size={14} />
          Bring back
        </button>
      ) : person.isYou ? null : (
        <button
          type="button"
          disabled={pending}
          title="Keep their history, stop them signing in"
          onClick={() =>
            startTransition(async () => {
              await archivePerson(person.id);
            })
          }
          className={buttonClass("danger", "sm")}
        >
          They have left
        </button>
      )}
    </div>
  );
}

function PersonForm({
  person,
  onClose,
  canChangeRole,
}: {
  person: PersonRow | null;
  onClose: () => void;
  canChangeRole: boolean;
}) {
  const [state, action, saving] = useActionState<PersonState, FormData>(
    savePerson,
    undefined,
  );
  const [role, setRole] = useState(person?.role ?? "employee");

  useEffect(() => {
    if (state?.ok) onClose();
  }, [state, onClose]);

  return (
    <form
      action={action}
      className="flex flex-col gap-4 rounded-lg border border-accent-line bg-accent-soft/30 p-4"
    >
      {person ? <input type="hidden" name="id" value={person.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Name"
          hint="What every screen calls them, theirs and yours."
        >
          <input
            id={`person-name-${person?.id ?? "new"}`}
            name="name"
            defaultValue={person?.name ?? ""}
            required
            autoFocus
            placeholder="e.g. Grace Dlamini"
            className={inputClass}
          />
        </Field>
        <Field label="What they do" hint="Optional, shown as a small label.">
          <input
            id={`person-job-${person?.id ?? "new"}`}
            name="jobTitle"
            defaultValue={person?.jobTitle ?? ""}
            placeholder="e.g. Nanny, Cleaner, Gardener"
            className={inputClass}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email" hint="They sign in with this.">
          <input
            id={`person-email-${person?.id ?? "new"}`}
            type="email"
            name="email"
            defaultValue={person?.email ?? ""}
            required
            className={inputClass}
          />
        </Field>
        <Field
          label={person ? "New password" : "Password"}
          hint={
            person
              ? "Leave empty to keep their current one."
              : "At least 8 characters. Give it to them directly."
          }
        >
          <input
            id={`person-password-${person?.id ?? "new"}`}
            type="password"
            name="password"
            autoComplete="new-password"
            className={inputClass}
          />
        </Field>
      </div>

      <Field
        label="What they can do"
        hint={
          canChangeRole
            ? "An admin plans and sees everything. Everyone else sees their own work."
            : "You cannot change your own role."
        }
      >
        <div className="flex overflow-hidden rounded-lg border border-line-strong">
          {(
            [
              ["employee", "Works here"],
              ["admin", "Admin"],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className={cn(
                "flex-1 py-2 text-center text-sm font-bold transition-colors",
                canChangeRole ? "cursor-pointer" : "cursor-not-allowed",
                role === value
                  ? "bg-accent text-accent-ink"
                  : "bg-surface text-ink-2 hover:bg-surface-2",
              )}
            >
              <input
                type="radio"
                name="role"
                value={value}
                checked={role === value}
                disabled={!canChangeRole}
                onChange={() => setRole(value)}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
        {!canChangeRole ? (
          <input type="hidden" name="role" value={role} />
        ) : null}
      </Field>

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
          {saving ? "Saving…" : person ? "Save" : "Add them"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className={buttonClass("ghost")}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
