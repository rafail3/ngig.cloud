/* MathLive renders with its own fonts, and Next cannot serve anything out of
   node_modules — so they have to exist under public/. Copying them on install
   rather than committing them keeps the files in step with the package: an
   upgrade that changes a font ships the new one automatically instead of
   leaving a stale copy in the repo to render the wrong glyphs.

   Runs as postinstall, which Vercel executes during its own install step. */

import { cp, mkdir, rm, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "node_modules", "mathlive", "fonts");
const to = join(root, "public", "mathlive", "fonts");

try {
  await access(from);
} catch {
  // The package is not installed (or npm is mid-flight on a partial tree).
  // Nothing to copy, and failing here would break the install.
  console.log("mathlive fonts: source not present, skipping");
  process.exit(0);
}

await rm(to, { recursive: true, force: true });
await mkdir(dirname(to), { recursive: true });
await cp(from, to, { recursive: true });
console.log(`mathlive fonts -> ${to}`);
