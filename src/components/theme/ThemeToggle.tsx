"use client";

import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme, type Theme } from "./ThemeProvider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Luminos", icon: Sun },
  { value: "dark", label: "Întunecat", icon: Moon },
  { value: "system", label: "Sistem", icon: Monitor },
];

// Three mutually exclusive choices, which is exactly a radio group — so it is
// built as one. Radix then supplies what the hand-rolled version never had:
// arrow-key navigation, Escape, typeahead, focus returning to the trigger on
// close, and `aria-checked` announcing the active theme to a screen reader.
export function ThemeToggle() {
  const { theme, resolved, setTheme } = useTheme();

  // The trigger always shows the EFFECTIVE theme (moon/sun) — even in "system"
  // mode we show what the user is actually looking at, never the monitor. The
  // monitor stays as the "Sistem" option inside the menu.
  const TriggerIcon = resolved === "dark" ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Schimbă tema"
        title="Temă"
        className="rounded-md p-2 text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-50 data-[state=open]:bg-zinc-900 data-[state=open]:text-zinc-50"
      >
        <TriggerIcon className="h-5 w-5" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuRadioGroup
          value={theme}
          onValueChange={(v) => setTheme(v as Theme)}
        >
          {OPTIONS.map((o) => {
            const Icon = o.icon;
            return (
              <DropdownMenuRadioItem key={o.value} value={o.value}>
                <Icon className="h-4 w-4" />
                {o.label}
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
