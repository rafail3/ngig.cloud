// Shared surfaces for the cost dashboard. The app themes by mirroring the zinc
// scale under html.light, which leaves faint /40 cards washed out on white — so
// here we opt into an explicit light treatment: a crisp white card with a soft
// shadow (reads as elevated on the near-white body), reverting to the glassy
// dark surface under `.dark`. `white`/`black` are left literal by the theme, so
// they don't get mirrored.

export const COST_CARD =
  "rounded-2xl border border-black/[0.07] bg-white shadow-sm dark:border-zinc-800/70 dark:bg-zinc-900/40 dark:shadow-none";

// Recharts tooltip/label styling via CSS vars so it themes with the app (dark
// surface in dark mode, light surface in light mode) instead of a fixed dark box.
export const chartTooltipStyle = {
  background: "var(--color-zinc-900)",
  border: "1px solid var(--color-zinc-700)",
  borderRadius: 12,
  color: "var(--color-zinc-50)",
  fontSize: 12,
} as const;
