"use client";

import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";

// A plain one-click light/dark switch for the public share page. Simpler and
// more reliable than the app's dropdown toggle here (no "system" option needed,
// and no menu that can be covered by page content).
export function ShareThemeToggle() {
  const { resolved, setTheme } = useTheme();
  const dark = resolved === "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={dark ? "Comută pe temă luminoasă" : "Comută pe temă întunecată"}
      title="Schimbă tema"
      className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-2 text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-100"
    >
      {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}
