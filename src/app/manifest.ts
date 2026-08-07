import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION, SITE_NAME, CHROME_DARK } from "@/lib/brand";

/* The install manifest — what the product is called and looks like once it
   leaves the browser tab.

   Without it, "Add to Home Screen" produces an icon cropped from a screenshot
   and labelled with whatever the page title happened to be. With it, the app
   installs as itself: its own name, its own mark, opening at the drive rather
   than at a browser chrome. `display: standalone` because there is nothing
   useful in a URL bar here — every route is either the app or a login. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: "ngig",
    description: SITE_DESCRIPTION,
    lang: "ro",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: CHROME_DARK,
    theme_color: CHROME_DARK,
    categories: ["productivity", "utilities"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Android crops installed icons to a circle or squircle. A `maskable`
      // entry is the one drawn with the mark inside the safe zone, so the
      // cloud does not lose its edges to the crop.
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
