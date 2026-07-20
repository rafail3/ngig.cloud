"use client";

import { useRouter } from "next/navigation";
import { CalendarRange } from "lucide-react";
import { Select } from "@/components/support/Select";
import type { MonthOption } from "@/lib/pricing";

// Period picker for the cost dashboard. The chosen month lives in the URL (?m=)
// so the view is deep-linkable and the server re-fetches egress for that window.
export function MonthSelector({
  months,
  selected,
}: {
  months: MonthOption[];
  selected: string;
}) {
  const router = useRouter();
  return (
    <Select
      value={selected}
      options={months.map((m) => ({ key: m.key, label: m.label }))}
      onChange={(key) => router.push(`?m=${key}`, { scroll: false })}
      icon={CalendarRange}
      ariaLabel="Perioadă"
      className="w-full sm:w-56"
      renderLabel={(l) => l.charAt(0).toUpperCase() + l.slice(1)}
    />
  );
}
