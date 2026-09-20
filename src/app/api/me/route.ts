import { pageData } from "@/lib/api";

export const dynamic = "force-dynamic";

export type MeData = {
  user: { id: number; name: string; role: "admin" | "employee" };
  household: { id: number; name: string; timezone: string };
};

export const GET = pageData<MeData>(async (viewer) => ({
  user: {
    id: viewer.user.id,
    name: viewer.user.name,
    role: viewer.user.role,
  },
  household: {
    id: viewer.household.id,
    name: viewer.household.name,
    timezone: viewer.household.timezone,
  },
}));
