import type { Metadata } from "next";
import { MenuPage } from "@/app/(employee)/menu/menu-page";

export const metadata: Metadata = { title: "Menu" };

/** A static shell; the menu fetches its own data on the client. */
export default function MenuShell() {
  return <MenuPage />;
}
