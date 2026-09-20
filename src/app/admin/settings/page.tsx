import type { Metadata } from "next";
import { AdminSettings } from "@/app/admin/settings/settings-page";

export const metadata: Metadata = { title: "Settings" };

/** A static shell; the settings page fetches its own data on the client. */
export default function SettingsPage() {
  return <AdminSettings />;
}
