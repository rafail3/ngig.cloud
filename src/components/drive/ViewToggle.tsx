"use client";

import { Button } from "@/components/ui/button";
import { LayoutGrid, List } from "lucide-react";
import { useViewMode, setViewMode, type ViewMode } from "./useViewMode";

// Grid vs list, the way every file manager offers it: a two-state segmented
// control, not a dropdown. The preference is stored per browser, so the drive
// opens the way it was left.
export function ViewToggle() {
  const view = useViewMode();

  return (
    <div
      role="group"
      aria-label="Mod de afișare"
      className="flex shrink-0 items-center gap-0.5 rounded-lg border border-zinc-800 bg-zinc-900/40 p-0.5"
    >
      <Option
        mode="grid"
        current={view}
        icon={<LayoutGrid className="h-4 w-4" />}
        label="Grilă"
      />
      <Option
        mode="list"
        current={view}
        icon={<List className="h-4 w-4" />}
        label="Listă"
      />
    </div>
  );
}

function Option({
  mode,
  current,
  icon,
  label,
}: {
  mode: ViewMode;
  current: ViewMode;
  icon: React.ReactNode;
  label: string;
}) {
  const active = current === mode;
  return (
    <Button variant="unstyled"
      type="button"
      onClick={() => setViewMode(mode)}
      // aria-pressed rather than a title alone: assistive tech needs the state,
      // not just the name.
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={`rounded-md p-1.5 transition-colors ${
        active
          ? "bg-zinc-800 text-zinc-100"
          : "text-zinc-400 hover:text-zinc-100"
      }`}
    >
      {icon}
    </Button>
  );
}
