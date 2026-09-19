"use client";

import { useOptimistic, useTransition } from "react";
import { IconCheck, cn } from "@/components/ui";

/**
 * A big, thumb-friendly tick box. The state flips immediately and the server
 * action catches up; if it fails the next render puts it back.
 */
export function CheckButton({
  done,
  label,
  disabled,
  size = "md",
  onToggle,
}: {
  done: boolean;
  label: string;
  disabled?: boolean;
  size?: "sm" | "md";
  onToggle: (next: boolean) => Promise<void>;
}) {
  const [, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(done);

  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={optimistic}
      aria-label={label}
      title={disabled ? "Only the person it is for can tick this off" : label}
      onClick={() => {
        startTransition(async () => {
          setOptimistic(!optimistic);
          await onToggle(!optimistic);
        });
      }}
      className={cn(
        "flex flex-none items-center justify-center rounded-lg border-2 transition-colors",
        size === "sm" ? "h-6 w-6" : "h-7 w-7",
        optimistic
          ? "border-accent bg-accent text-accent-ink"
          : "border-line-strong bg-surface text-transparent",
        disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer hover:border-accent",
      )}
    >
      <IconCheck size={size === "sm" ? 14 : 16} className="stroke-3" />
    </button>
  );
}
