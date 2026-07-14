"use client";

import { useState } from "react";
import { CheckCircle2, AlertCircle, X, ChevronDown, Loader2 } from "lucide-react";
import { useUploads, type UploadJob } from "./UploadProvider";
import { formatBytes } from "@/lib/format";

function speedLabel(bytesPerSec: number): string {
  if (!bytesPerSec || bytesPerSec < 1) return "—";
  return `${formatBytes(bytesPerSec)}/s`;
}

function etaLabel(sec: number | null): string {
  if (sec == null || !isFinite(sec)) return "—";
  const s = Math.max(0, Math.round(sec));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

function Card({
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

  return (
    <div className="border-b border-zinc-800/80 px-3 py-2.5 last:border-b-0">
      <div className="flex items-center gap-2">
        {job.status === "done" && (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
        )}
        {job.status === "error" && (
          <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
        )}
        {active && (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-indigo-400" />
        )}
        <span className="min-w-0 flex-1 truncate text-sm text-zinc-200">
          {job.name}
        </span>
        {active ? (
          <button
            type="button"
            onClick={() => onCancel(job.id)}
            aria-label="Anulează"
            className="shrink-0 rounded p-0.5 text-zinc-500 transition hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onDismiss(job.id)}
            aria-label="Închide"
            className="shrink-0 rounded p-0.5 text-zinc-500 transition hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {active && (
        <>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-indigo-500 transition-[width] duration-200"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-zinc-500">
            <span>
              {pct}% · {formatBytes(job.sent)} / {formatBytes(job.size)}
            </span>
            <span>
              {job.status === "queued"
                ? "În așteptare"
                : `${speedLabel(job.speed)} · ${etaLabel(job.etaSec)}`}
            </span>
          </div>
        </>
      )}

      {job.status === "done" && (
        <p className="mt-1 text-[11px] text-emerald-400">
          Încărcat · {formatBytes(job.size)}
        </p>
      )}
      {job.status === "canceled" && (
        <p className="mt-1 text-[11px] text-zinc-500">Anulat</p>
      )}
      {job.status === "error" && (
        <p className="mt-1 text-[11px] text-red-400">{job.error ?? "Eroare"}</p>
      )}
    </div>
  );
}

export function UploadPanel() {
  const { jobs, cancel, dismiss, clearFinished } = useUploads();
  const [collapsed, setCollapsed] = useState(false);

  if (jobs.length === 0) return null;

  const activeCount = jobs.filter(
    (j) => j.status === "uploading" || j.status === "queued",
  ).length;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[min(92vw,22rem)] overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl">
      <div className="flex items-center justify-between gap-2 border-b border-zinc-800 px-3 py-2.5">
        <p className="text-sm font-semibold text-zinc-100">
          {activeCount > 0
            ? `Se încarcă (${activeCount})`
            : "Încărcări"}
        </p>
        <div className="flex items-center gap-1">
          {activeCount === 0 && (
            <button
              type="button"
              onClick={clearFinished}
              className="rounded px-2 py-1 text-xs text-zinc-400 transition hover:text-zinc-100"
            >
              Curăță
            </button>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? "Extinde" : "Restrânge"}
            className="rounded p-1 text-zinc-400 transition hover:text-zinc-100"
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform ${collapsed ? "" : "rotate-180"}`}
            />
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="max-h-[50vh] overflow-y-auto">
          {jobs.map((job) => (
            <Card key={job.id} job={job} onCancel={cancel} onDismiss={dismiss} />
          ))}
        </div>
      )}
    </div>
  );
}
