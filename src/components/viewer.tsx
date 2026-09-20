"use client";

import { logout } from "@/app/actions/auth";
import { Skeleton } from "@/components/skeleton";
import { Avatar, IconLogout, buttonClass, cn } from "@/components/ui";
import { clearData, useClientData } from "@/lib/client-data";
import type { MeData } from "@/app/api/me/route";

/**
 * The bits of layout chrome that name the signed-in person. Layouts are static
 * shells, so these fetch the viewer themselves and show a placeholder until it
 * arrives; after the first page it is already cached and paints at once.
 */
export function useMe() {
  return useClientData<MeData>("/api/me");
}

export function HouseholdName({ className }: { className?: string }) {
  const { data } = useMe();
  if (!data) return <Skeleton className={cn("h-4 w-28", className)} />;
  return <span className={className}>{data.household.name}</span>;
}

export function ViewerName({ className }: { className?: string }) {
  const { data } = useMe();
  if (!data) return <Skeleton className={cn("h-3.5 w-20", className)} />;
  return <span className={className}>{data.user.name}</span>;
}

export function ViewerAvatar({
  role,
  size,
}: {
  role: "admin" | "employee";
  size?: "sm" | "md";
}) {
  const { data } = useMe();
  if (!data) {
    return (
      <Skeleton
        className={cn("rounded-full", size === "sm" ? "h-7 w-7" : "h-9 w-9")}
      />
    );
  }
  return <Avatar name={data.user.name} role={role} size={size} />;
}

export function LogoutButton({ className }: { className?: string }) {
  return (
    <form
      action={async () => {
        // Nothing of this person may survive in memory for the next one.
        clearData();
        await logout();
      }}
    >
      <button
        type="submit"
        aria-label="Sign out"
        title="Sign out"
        className={buttonClass("ghost", "sm", className ?? "h-9 w-9 px-0")}
      >
        <IconLogout size={16} />
      </button>
    </form>
  );
}
