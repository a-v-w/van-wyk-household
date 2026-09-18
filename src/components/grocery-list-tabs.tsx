import Link from "next/link";
import type { GroceryList } from "@/db/schema";
import { Chip, cn } from "@/components/ui";

/** Switches between the household's lists. Hidden when there is only one. */
export function GroceryListTabs({
  lists,
  current,
  basePath,
  counts,
}: {
  lists: GroceryList[];
  current: GroceryList;
  basePath: string;
  /** Open item counts, keyed by list id. */
  counts?: Map<number, number>;
}) {
  if (lists.length <= 1) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {lists.map((list) => {
        const active = list.id === current.id;
        const count = counts?.get(list.id) ?? 0;
        return (
          <Link
            key={list.id}
            href={`${basePath}?list=${list.id}`}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors",
              active
                ? "border-accent bg-accent-soft text-accent"
                : "border-line bg-surface text-ink-2 hover:bg-surface-2",
            )}
          >
            {list.name}
            {list.kind === "standing" ? (
              <span className="text-[10px] font-semibold opacity-70">
                always open
              </span>
            ) : null}
            {count > 0 ? (
              <Chip
                tone={active ? "accent" : "neutral"}
                className="px-1.5 py-0 text-[10px]"
              >
                {count}
              </Chip>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
