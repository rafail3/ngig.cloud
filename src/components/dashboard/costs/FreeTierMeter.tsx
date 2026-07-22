"use client";

import { motion, useReducedMotion } from "motion/react";
import { Gift, HardDrive, ArrowDownToLine } from "lucide-react";
import { formatBytes } from "@/lib/format";
import { COST_CARD } from "./styles";

// How close usage is to a free-tier ceiling, and the color that conveys it.
// Green well under, amber closing in, red at/over (over = you start paying).
function tier(pct: number) {
  if (pct >= 1) return { bar: "from-red-500 to-red-400", text: "text-red-400", state: "over" as const };
  if (pct >= 0.9) return { bar: "from-red-500 to-orange-400", text: "text-red-400", state: "near" as const };
  if (pct >= 0.75) return { bar: "from-amber-500 to-amber-400", text: "text-amber-400", state: "near" as const };
  return { bar: "from-emerald-500 to-emerald-400", text: "text-emerald-400", state: "ok" as const };
}

function Meter({
  icon,
  label,
  used,
  limit,
  reduced,
}: {
  icon: React.ReactNode;
  label: string;
  used: number;
  limit: number;
  reduced: boolean;
}) {
  const pct = limit > 0 ? used / limit : 0;
  const t = tier(pct);
  const width = Math.min(100, pct * 100);
  const remaining = Math.max(0, limit - used);

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
        <span className="flex items-center gap-2 text-zinc-300">
          <span className="text-zinc-500">{icon}</span>
          {label}
        </span>
        <span className="tabular-nums text-zinc-400">
          {formatBytes(used)} <span className="text-zinc-600">/ {formatBytes(limit)}</span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-500/20">
        <motion.div
          className={`h-full rounded-full bg-gradient-to-r ${t.bar}`}
          initial={reduced ? false : { width: 0 }}
          animate={{ width: `${width}%` }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        />
      </div>
      <p className={`mt-1.5 text-[11px] ${t.text}`}>
        {t.state === "over"
          ? "Depășit — plătești pentru surplus"
          : `${(pct * 100).toFixed(pct < 0.1 ? 1 : 0)}% folosit · ${formatBytes(remaining)} rămași gratuit`}
      </p>
    </div>
  );
}

// The "free tier" panel: how much of B2's always-free allowances the platform
// is using (10 GB storage, 3x-storage monthly egress). The bar reddens as usage
// nears the ceiling — the moment real cost begins.
export function FreeTierMeter({
  storageBytes,
  freeStorageBytes,
  egressBytes,
  egressFreeBytes,
  egressMonths = 1,
}: {
  storageBytes: number;
  freeStorageBytes: number;
  egressBytes: number;
  egressFreeBytes: number;
  // Months the selected window spans — the free egress allowance is monthly,
  // so a 3-month window shows (and earns) a 3x allowance.
  egressMonths?: number;
}) {
  const reduced = useReducedMotion() ?? false;
  return (
    <section className={`${COST_CARD} p-4 sm:p-5`}>
      <div className="mb-4 flex items-center gap-2">
        <Gift className="h-4 w-4 text-emerald-400" />
        <h2 className="text-sm font-semibold text-zinc-200">Nivel gratuit Backblaze B2</h2>
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Meter
          icon={<HardDrive className="h-4 w-4" />}
          label="Stocare gratuită"
          used={storageBytes}
          limit={freeStorageBytes}
          reduced={reduced}
        />
        <Meter
          icon={<ArrowDownToLine className="h-4 w-4" />}
          label={egressMonths > 1 ? `Egress gratuit (${egressMonths} luni)` : "Egress gratuit (lună)"}
          used={egressBytes}
          limit={egressFreeBytes}
          reduced={reduced}
        />
      </div>
    </section>
  );
}
