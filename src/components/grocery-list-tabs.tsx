import Link from "next/link";
import type { GroceryList } from "@/db/schema";
import { Chip, cn } from "@/components/ui";

/** One list as the tabs show it: plain JSON, with its open item count. */
export type GroceryTab = {
  id: number;
  name: string;
  kind: GroceryList["kind"];
  /** Pending items on its current cycle. */
  count: number;
};

/** Switches between the household's lists. Hidden when there is only one. */
export function GroceryListTabs({
  tabs,
  currentId,
  basePath,
}: {
  tabs: GroceryTab[];
  currentId: number;
  basePath: string;
}) {
  if (tabs.length <= 1) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {tabs.map((tab) => {
        const active = tab.id === currentId;
        return (
          <Link
            key={tab.id}
            href={`${basePath}?list=${tab.id}`}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors",
              active
                ? "border-accent bg-accent-soft text-accent"
                : "border-line bg-surface text-ink-2 hover:bg-surface-2",
            )}
          >
            {tab.name}
            {tab.kind === "standing" ? (
              <span className="text-[10px] font-semibold opacity-70">
                always open
              </span>
            ) : null}
            {tab.count > 0 ? (
              <Chip
                tone={active ? "accent" : "neutral"}
                className="px-1.5 py-0 text-[10px]"
              >
                {tab.count}
              </Chip>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
