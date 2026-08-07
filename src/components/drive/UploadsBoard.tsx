"use client";

import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "motion/react";
import {
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  UploadCloud,
  Ban,
  Clock,
  Gauge,
} from "lucide-react";
import Link from "next/link";
import { useUploads, type UploadJob, type UploadStatus } from "./UploadProvider";
import { formatBytes } from "@/lib/format";
import { EmptyState } from "@/components/common/EmptyState";

export function speedLabel(bytesPerSec: number): string {
  if (!bytesPerSec || bytesPerSec < 1) return "—";
  return `${formatBytes(bytesPerSec)}/s`;
}

export function etaLabel(sec: number | null): string {
  if (sec == null || !isFinite(sec)) return "—";
  const s = Math.max(0, Math.round(sec));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

const STATUS_META: Record<
  UploadStatus,
  { label: string; icon: typeof Clock; className: string }
> = {
  queued: { label: "În așteptare", icon: Clock, className: "text-zinc-400" },
  uploading: { label: "Se încarcă", icon: Loader2, className: "text-indigo-300" },
  done: { label: "Încărcat", icon: CheckCircle2, className: "text-emerald-300" },
  error: { label: "Eroare", icon: AlertCircle, className: "text-red-300" },
  canceled: { label: "Anulat", icon: Ban, className: "text-zinc-400" },
};

// The full-page view of what's uploading right now. Reads the same
// UploadProvider the corner panel does — the provider is mounted in AppShell, so
// both surfaces show one shared state and cancelling here is the same action as
// cancelling there. Deliberately shows only live work: finished jobs clear
// themselves, and there is no persisted history to browse.
export function UploadsBoard() {
  const { jobs, cancel, dismiss } = useUploads();

  const active = jobs.filter((j) => j.status === "uploading" || j.status === "queued");
  const totalSize = active.reduce((s, j) => s + j.size, 0);
  const totalSent = active.reduce((s, j) => s + j.sent, 0);
  const totalSpeed = jobs
    .filter((j) => j.status === "uploading")
    .reduce((s, j) => s + j.speed, 0);
  // Remaining bytes over combined throughput — a truer figure than summing the
  // per-file ETAs, which would count queued files as if they ran in parallel.
  const overallEta = totalSpeed > 0 ? (totalSize - totalSent) / totalSpeed : null;
  const overallPct = totalSize > 0 ? Math.min(100, Math.round((totalSent / totalSize) * 100)) : 0;

  if (jobs.length === 0) {
    return (
      <EmptyState
        icon={UploadCloud}
        title="Niciun upload în curs"
        description="Trage fișiere în drive sau folosește butonul de încărcare — progresul apare aici."
        action={
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-zinc-700 hover:text-zinc-50"
          >
            <UploadCloud className="h-4 w-4" />
            Mergi la fișiere
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      {active.length > 0 && (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="text-sm font-semibold text-zinc-100">
              Se încarcă {active.length}{" "}
              {active.length === 1 ? "element" : "elemente"}
            </p>
            <p className="text-sm font-semibold tabular-nums text-zinc-100">
              {overallPct}%
            </p>
          </div>

          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
            <motion.div
              className="h-full rounded-full bg-indigo-500"
              initial={false}
              animate={{ width: `${overallPct}%` }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-zinc-400">
            <span className="tabular-nums">
              {formatBytes(totalSent)} / {formatBytes(totalSize)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Gauge className="h-3.5 w-3.5" />
              {speedLabel(totalSpeed)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {etaLabel(overallEta)} rămase
            </span>
          </div>
        </section>
      )}

      <ul className="space-y-2">
        <AnimatePresence initial={false} mode="popLayout">
          {jobs.map((job) => (
            <JobRow key={job.id} job={job} onCancel={cancel} onDismiss={dismiss} />
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}

function JobRow({
  job,
  onCancel,
  onDismiss,
}: {
  job: UploadJob;
  onCancel: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const pct = job.size > 0 ? Math.min(100, Math.round((job.sent / job.size) * 100)) : 0;
  const active = job.status === "uploading" || job.status === "queued";
  const { label, icon: Icon, className } = STATUS_META[job.status];

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6, transition: { duration: 0.15 } }}
      className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3.5"
    >
      <div className="flex items-center gap-3">
        <span className={`shrink-0 ${className}`} aria-hidden>
          <Icon
            className={`h-4 w-4 ${job.status === "uploading" ? "animate-spin" : ""}`}
          />
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium leading-6 text-zinc-100">
            {job.name}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] leading-5 text-zinc-400">
            <span className={className}>{label}</span>
            <span aria-hidden className="text-zinc-600">
              ·
            </span>
            <span className="tabular-nums">
              {active
                ? `${formatBytes(job.sent)} / ${formatBytes(job.size)}`
                : formatBytes(job.size)}
            </span>
            {job.status === "uploading" && (
              <>
                <span aria-hidden className="text-zinc-600">
                  ·
                </span>
                <span className="tabular-nums">{speedLabel(job.speed)}</span>
                <span aria-hidden className="text-zinc-600">
                  ·
                </span>
                <span className="tabular-nums">{etaLabel(job.etaSec)}</span>
              </>
            )}
          </p>
          {job.status === "error" && job.error && (
            <p className="mt-1 text-[13px] text-red-300">{job.error}</p>
          )}
        </div>

        <span className="hidden shrink-0 text-sm font-semibold tabular-nums text-zinc-300 sm:block">
          {active ? `${pct}%` : ""}
        </span>

        <Button variant="unstyled"
          type="button"
          onClick={() => (active ? onCancel(job.id) : onDismiss(job.id))}
          aria-label={active ? `Anulează ${job.name}` : `Închide ${job.name}`}
          className="shrink-0 rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {active && (
        <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
          <motion.div
            className="h-full rounded-full bg-indigo-500"
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          />
        </div>
      )}
    </motion.li>
  );
}
