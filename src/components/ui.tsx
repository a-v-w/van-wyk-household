import type { ComponentProps, ReactNode } from "react";

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ card -- */

export function Card({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-xl border border-line bg-surface shadow-[var(--shadow-sm)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  action,
  className,
}: {
  title: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-5 pt-4 pb-2",
        className,
      )}
    >
      <div className="label">{title}</div>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ chip -- */

type ChipTone = "neutral" | "accent" | "lock" | "danger" | "ok";

const CHIP_TONES: Record<ChipTone, string> = {
  neutral: "bg-surface-2 text-ink-2 border-line",
  accent: "bg-accent-soft text-accent border-accent-line",
  lock: "bg-lock-soft text-lock border-lock-line",
  danger: "bg-danger-soft text-danger border-danger-line",
  ok: "bg-ok-soft text-ok border-transparent",
};

export function Chip({
  tone = "neutral",
  className,
  children,
  ...props
}: ComponentProps<"span"> & { tone?: ChipTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold whitespace-nowrap",
        CHIP_TONES[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

/* --------------------------------------------------------------- buttons -- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-accent-ink border-accent hover:bg-accent-hover hover:border-accent-hover",
  secondary:
    "bg-surface text-ink border-line-strong hover:bg-surface-2",
  ghost: "bg-transparent text-ink-2 border-transparent hover:bg-surface-2",
  danger:
    "bg-surface text-danger border-danger-line hover:bg-danger-soft",
};

export function buttonClass(
  variant: ButtonVariant = "secondary",
  size: "sm" | "md" = "md",
  className?: string,
): string {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-lg border font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer",
    size === "sm" ? "h-8 px-3 text-[13px]" : "h-10 px-4 text-sm",
    BUTTON_VARIANTS[variant],
    className,
  );
}

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: "sm" | "md";
}) {
  return (
    <button className={buttonClass(variant, size, className)} {...props} />
  );
}

/* ---------------------------------------------------------------- inputs -- */

export const inputClass =
  "w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25";

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span className="label">{label}</span>
      {children}
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </div>
  );
}

/* ---------------------------------------------------------------- person -- */

/** A small round badge carrying a person's initials. */
export function Avatar({
  name,
  role,
  size = "md",
}: {
  name: string;
  role?: "admin" | "employee";
  size?: "sm" | "md";
}) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const text =
    parts.length === 0
      ? "?"
      : parts.length === 1
        ? parts[0][0]
        : parts[0][0] + parts[parts.length - 1][0];

  return (
    <span
      title={name}
      className={cn(
        "inline-flex flex-none items-center justify-center rounded-full font-bold uppercase",
        size === "sm" ? "h-6 w-6 text-[10px]" : "h-7 w-7 text-[11px]",
        role === "admin"
          ? "bg-surface-3 text-ink-2"
          : "bg-accent-soft text-accent",
      )}
    >
      {text}
    </span>
  );
}

/* ------------------------------------------------------------- stat tile -- */

type StatTone = "accent" | "danger" | "lock" | "ok";

const STAT_TONES: Record<StatTone, string> = {
  accent: "text-accent",
  danger: "text-danger",
  lock: "text-lock",
  ok: "text-ok",
};

/** One number with its label. The figure leads; the words explain it. */
export function StatTile({
  label,
  value,
  hint,
  tone,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: StatTone;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-0.5 rounded-lg bg-surface-2 px-3 py-2.5",
        className,
      )}
    >
      <span
        className={cn(
          "font-mono text-2xl leading-none font-bold tabular",
          tone ? STAT_TONES[tone] : "text-ink",
        )}
      >
        {value}
      </span>
      <span className="text-xs font-semibold text-ink-2">{label}</span>
      {hint ? <span className="text-[11px] text-muted">{hint}</span> : null}
    </div>
  );
}

/* ------------------------------------------------------------ empty state -- */

export function Empty({
  title,
  hint,
  className,
}: {
  title: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1 px-6 py-10 text-center",
        className,
      )}
    >
      <p className="text-sm font-semibold text-ink-2">{title}</p>
      {hint ? <p className="max-w-xs text-sm text-muted">{hint}</p> : null}
    </div>
  );
}

/* ----------------------------------------------------------------- icons -- */

type IconProps = { className?: string; size?: number };

function icon(path: ReactNode) {
  return function Icon({ className, size = 20 }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={className}
      >
        {path}
      </svg>
    );
  };
}

export const IconCheck = icon(<path d="M5 12l5 5L19 7" />);
export const IconChecklist = icon(
  <>
    <path d="M9 11l3 3L22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </>,
);
export const IconList = icon(
  <>
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
  </>,
);
export const IconMenu = icon(
  <>
    <path d="M3 11h18M5 11a7 7 0 0 1 14 0M4 15h16M6 19h12" />
  </>,
);
export const IconCart = icon(
  <>
    <path d="M6 6h15l-1.5 9h-12z" />
    <path d="M6 6L5 3H2" />
    <circle cx="9" cy="20" r="1" />
    <circle cx="18" cy="20" r="1" />
  </>,
);
export const IconGrid = icon(
  <>
    <rect x="3" y="3" width="8" height="8" rx="1.5" />
    <rect x="13" y="3" width="8" height="8" rx="1.5" />
    <rect x="3" y="13" width="8" height="8" rx="1.5" />
    <rect x="13" y="13" width="8" height="8" rx="1.5" />
  </>,
);
export const IconSettings = icon(
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </>,
);
export const IconLock = icon(
  <>
    <rect x="4" y="10" width="16" height="11" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </>,
);
export const IconUnlock = icon(
  <>
    <rect x="4" y="10" width="16" height="11" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 7.5-2" />
  </>,
);
export const IconPlus = icon(<path d="M12 5v14M5 12h14" />);
export const IconTrash = icon(
  <>
    <path d="M4 7h16M10 11v6M14 11v6" />
    <path d="M5 7l1 13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-13" />
    <path d="M9 7V4h6v3" />
  </>,
);
export const IconArrowRight = icon(<path d="M5 12h14M13 6l6 6-6 6" />);
export const IconPencil = icon(
  <>
    <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z" />
    <path d="M13.5 6.5l4 4" />
  </>,
);
export const IconBook = icon(
  <>
    <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" />
    <path d="M8 7h7M8 11h7" />
  </>,
);
export const IconChevronLeft = icon(<path d="M15 6l-6 6 6 6" />);
export const IconChevronRight = icon(<path d="M9 6l6 6-6 6" />);
export const IconCalendar = icon(
  <>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </>,
);
export const IconClock = icon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v4l3 2" />
  </>,
);
export const IconCopy = icon(
  <>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </>,
);
export const IconSun = icon(
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </>,
);
export const IconMoon = icon(
  <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
);
export const IconLogout = icon(
  <>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5M21 12H9" />
  </>,
);
export const IconUndo = icon(
  <>
    <path d="M9 14l-5-5 5-5" />
    <path d="M4 9h11a5 5 0 0 1 0 10h-3" />
  </>,
);
