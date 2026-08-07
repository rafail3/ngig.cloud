/* The brand facts, in one place.

   These were scattered before: the name was spelled "ngig Cloud" in the root
   metadata and "ngig.cloud" everywhere a human could see it, the description
   was written out three times in slightly different words, and the chrome
   colour was a hex literal wherever something needed one. That drift is how a
   product ends up with two logos on two pages and nobody noticing.

   Only put things here that describe the BRAND and are consumed by more than
   one surface. Component styling belongs in the components; the themed colour
   scales belong in globals.css. */

export const SITE_NAME = "ngig.cloud";

export const SITE_DESCRIPTION =
  "Cloudul tău privat — fișiere, foldere și partajări, rapid și sigur.";

export const SITE_URL = "https://ngig.cloud";

/* The chrome surface, as a literal.

   `--surface-chrome` in globals.css is the same colour, but it is a CSS
   variable resolved in the browser — a manifest and a `theme-color` tag are
   read by the OS before any stylesheet runs, and an `ImageResponse` is painted
   on a server with no stylesheet at all. Those three need the value itself.
   Keep them in step with the zinc-950 / zinc-900 pair in globals.css. */
export const CHROME_DARK = "#09090b";
export const CHROME_LIGHT = "#fafafa";

/** The accent, matching the `indigo` remap in globals.css (electric blue). */
export const ACCENT = "#60a5fa";
