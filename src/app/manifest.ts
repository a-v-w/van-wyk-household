import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Household",
    short_name: "Household",
    description:
      "Tasks, menus and the weekly grocery list for the van Wyk household.",
    start_url: "/",
    display: "standalone",
    background_color: "#faf8fd",
    theme_color: "#6d3fc4",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
