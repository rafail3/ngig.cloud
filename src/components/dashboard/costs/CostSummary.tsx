"use client";

import { motion, useReducedMotion } from "motion/react";
import { HardDrive, ArrowDownToLine, Repeat, Wallet, Users } from "lucide-react";
import { formatBytes } from "@/lib/format";
import { formatUsd, type PlatformCost } from "@/lib/pricing";
import { AnimatedValue } from "./AnimatedValue";

// Platform cost summary — one prominent "total / month" hero card plus three
// breakdown tiles (storage, egress, transactions). Numbers count up on load.
export function CostSummary({ platform }: { platform: PlatformCost }) {
  const reduced = useReducedMotion();
  const rise = (i: number) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 12 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.35, delay: i * 0.06, ease: "easeOut" as const },
        };

  return (
    <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-3">
      {/* Hero: total monthly cost */}
      <motion.div
        {...rise(0)}
        className="relative overflow-hidden rounded-2xl border border-indigo-500/25 bg-gradient-to-br from-indigo-500/12 via-zinc-900/40 to-zinc-900/40 p-5 sm:p-6 lg:row-span-1"
      >
        <div className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-indigo-500/15 blur-3xl" />
        <div className="flex items-center gap-2 text-indigo-300">
          <Wallet className="h-4 w-4" />
          <span className="text-xs font-medium uppercase tracking-wide">Cost total estimat</span>
        </div>
        <AnimatedValue
          value={platform.totalCost}
          format={formatUsd}
          className="mt-3 block text-4xl font-semibold tracking-tight text-zinc-50 sm:text-5xl"
        />
        <p className="mt-2 text-sm text-zinc-400">
          pe lună, la tarifele Backblaze B2 curente
        </p>
        <div className="mt-4 flex items-center gap-1.5 text-xs text-zinc-500">
          <Users className="h-3.5 w-3.5" />
          {platform.userCount} {platform.userCount === 1 ? "utilizator" : "utilizatori"} ·{" "}
          {formatBytes(platform.storageBytes)} stocați
        </div>
      </motion.div>

      {/* Breakdown tiles */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4 lg:col-span-2">
        <Tile
          {...rise(1)}
          icon={<HardDrive className="h-4 w-4" />}
          label="Stocare"
          cost={platform.storageCost}
          detail={`${formatBytes(platform.storageBytes)} · snapshot`}
          accent="text-blue-300"
        />
        <Tile
          {...rise(2)}
          icon={<ArrowDownToLine className="h-4 w-4" />}
          label="Egress"
          cost={platform.egressCost}
          detail={
            platform.egressBillableBytes > 0
              ? `${formatBytes(platform.egressBillableBytes)} taxabil`
              : `${formatBytes(platform.egressBytes)} · în limita gratuită`
          }
          accent="text-amber-300"
        />
        <Tile
          {...rise(3)}
          icon={<Repeat className="h-4 w-4" />}
          label="Tranzacții"
          cost={platform.transactionsCost}
          detail="Class A/B/C gratuite"
          accent="text-emerald-300"
        />
      </div>
    </div>
  );
}

function Tile({
  icon,
  label,
  cost,
  detail,
  accent,
  ...motionProps
}: {
  icon: React.ReactNode;
  label: string;
  cost: number;
  detail: string;
  accent: string;
} & React.ComponentProps<typeof motion.div>) {
  return (
    <motion.div
      {...motionProps}
      className="flex flex-col rounded-2xl border border-zinc-800/70 bg-zinc-900/40 p-4 sm:p-5"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-500">{label}</span>
        <span className={accent}>{icon}</span>
      </div>
      <AnimatedValue
        value={cost}
        format={formatUsd}
        className="mt-2 block text-2xl font-semibold tracking-tight text-zinc-50"
      />
      <span className="mt-1.5 text-[11px] leading-tight text-zinc-500">{detail}</span>
    </motion.div>
  );
}
