import { Card, cn } from "@/components/ui";

/** A grey block that stands in for text or a control while data loads. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-md bg-surface-3", className)}
    />
  );
}

/** A card of skeleton lines. */
export function SkeletonCard({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <Card className={cn("flex flex-col gap-3 p-5", className)}>
      <Skeleton className="h-3 w-24" />
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          className={i % 2 === 0 ? "h-4 w-full" : "h-4 w-2/3"}
        />
      ))}
    </Card>
  );
}

/**
 * The shape of a page before its data arrives: date line, title, and a few
 * cards. Admin pages are wide; employee pages use the narrow variant.
 */
export function PageSkeleton({
  variant = "admin",
  cards = 3,
}: {
  variant?: "admin" | "employee";
  cards?: number;
}) {
  const admin = variant === "admin";
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(
        "flex flex-col",
        admin ? "gap-6 px-5 py-6 lg:px-8 lg:py-8" : "gap-5 px-4 pt-2 pb-8",
      )}
    >
      <div className="flex flex-col gap-2 px-1">
        <Skeleton className="h-3 w-40" />
        <Skeleton className={admin ? "h-8 w-56" : "h-7 w-40"} />
      </div>
      {Array.from({ length: cards }, (_, i) => (
        <SkeletonCard key={i} lines={i === 0 ? 4 : 3} />
      ))}
    </div>
  );
}

/** What a page shows when its request failed. */
export function PageError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-5 py-16 text-center">
      <p className="text-sm font-semibold">Could not load this page.</p>
      <p className="text-sm text-muted">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold hover:bg-surface-2"
      >
        Try again
      </button>
    </div>
  );
}
