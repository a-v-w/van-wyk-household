"use client";

import { useState, useTransition } from "react";
import { finishOrdering, unlockCycle } from "@/app/actions/groceries";
import {
  IconCopy,
  IconLock,
  IconUnlock,
  buttonClass,
} from "@/components/ui";
import { invalidateData } from "@/lib/client-data";

/** Copies the list as plain lines, for pasting into the shop's own app. */
export function CopyListButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      disabled={!text}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          setCopied(false);
        }
      }}
      className={buttonClass("secondary", "sm")}
    >
      <IconCopy size={16} />
      {copied ? "Copied" : "Copy as text"}
    </button>
  );
}

export function UnlockButton({
  cycleId,
  unlocked,
}: {
  cycleId: number;
  unlocked: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await unlockCycle(cycleId, !unlocked);
          invalidateData();
        })
      }
      className={buttonClass("secondary", "sm")}
      title={
        unlocked
          ? "Lock it again so nothing else is added"
          : "Reopen the list so items can still be added"
      }
    >
      {unlocked ? <IconLock size={16} /> : <IconUnlock size={16} />}
      {unlocked ? "Lock again" : "Unlock"}
    </button>
  );
}

export function FinishOrderingButton({
  cycleId,
  remaining,
}: {
  cycleId: number;
  remaining: number;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await finishOrdering(cycleId);
          invalidateData();
        })
      }
      className={buttonClass("primary", "sm")}
      title={
        remaining > 0
          ? `${remaining} still unresolved; they will be marked ordered`
          : undefined
      }
    >
      {pending ? "Closing…" : "Mark the order placed"}
    </button>
  );
}
