"use client";

import { useSyncExternalStore } from "react";
import { IconMoon, IconSun, cn } from "@/components/ui";

type Theme = "light" | "dark" | "system";

const EVENT = "household:theme";
const ORDER: Theme[] = ["light", "dark", "system"];

const LABEL: Record<Theme, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Reads the stored choice. "system" means no explicit choice. */
function readTheme(): Theme {
  try {
    const stored = localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // Private windows and blocked site data both land here.
  }
  return "system";
}

/** The server has no idea what the viewer picked, so it renders the default. */
function serverTheme(): Theme {
  return "system";
}

function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  try {
    if (theme === "system") {
      root.removeAttribute("data-theme");
      localStorage.removeItem("theme");
    } else {
      root.setAttribute("data-theme", theme);
      localStorage.setItem("theme", theme);
    }
  } catch {
    // Storage can fail; the attribute is what actually paints the page.
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Cycles light → dark → follow the system. */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, readTheme, serverTheme);

  return (
    <button
      type="button"
      onClick={() => applyTheme(ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length])}
      aria-label={`Theme: ${LABEL[theme]}. Change it.`}
      title={`Theme: ${LABEL[theme]}`}
      className={cn(
        "inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-line px-3 text-xs font-semibold text-ink-2 transition-colors hover:bg-surface-2",
        className,
      )}
    >
      {theme === "dark" ? (
        <IconMoon size={16} />
      ) : (
        <IconSun size={16} className={theme === "system" ? "opacity-60" : ""} />
      )}
      <span suppressHydrationWarning>{LABEL[theme]}</span>
    </button>
  );
}
