"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  Pause,
  Play,
  Server,
  RefreshCw,
} from "lucide-react";
import {
  getOfficeHealthAction,
  getOfficeServerInfoAction,
  type OfficeHealthSample,
  type OfficeServerInfo,
} from "@/app/dashboard/(panel)/settings/actions";

const POLL_MS = 1000;
const WINDOW = 40; // samples kept for the graph (~40s of history)
const BASELINE_MS = 200; // graph never shows a scale smaller than this

type State = "up" | "timeout" | "down" | "unknown";

function sampleState(s: OfficeHealthSample | undefined): State {
  if (!s) return "unknown";
  if (s.up) return "up";
  if (s.timedOut) return "timeout";
  return "down";
}

const STATE_META: Record<State, { label: string; dot: string; text: string }> = {
  up: { label: "Operațional", dot: "bg-emerald-500", text: "text-emerald-400" },
  timeout: { label: "Timeout", dot: "bg-amber-500", text: "text-amber-400" },
  down: { label: "Oprit", dot: "bg-red-500", text: "text-red-400" },
  unknown: { label: "Se verifică…", dot: "bg-zinc-500", text: "text-zinc-400" },
};

function Metric({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 px-3 py-2.5">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-zinc-100">
        {value}
        {unit && <span className="ml-0.5 text-xs font-normal text-zinc-500">{unit}</span>}
      </p>
    </div>
  );
}

// A compact bar-per-second graph of recent latency. Bars are green when the
// server answered, red when it didn't — so an outage reads as a wall of red
// rather than a missing line.
function LatencyGraph({ samples }: { samples: OfficeHealthSample[] }) {
  const peak = Math.max(
    BASELINE_MS,
    ...samples.map((s) => s.latencyMs ?? 0),
  );
  const slotW = 100 / WINDOW;

  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-3">
      <svg
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
        className="h-16 w-full"
        role="img"
        aria-label={`Timp de răspuns pe ultimele ${samples.length} verificări`}
      >
        {samples.map((s, i) => {
          // Right-align: the newest sample sits at the far right.
          const x = 100 - (samples.length - i) * slotW;
          const answered = s.latencyMs != null;
          const h = answered ? Math.max(2, (s.latencyMs! / peak) * 36) : 36;
          return (
            <rect
              key={s.checkedAt}
              x={x + slotW * 0.15}
              y={40 - h}
              width={slotW * 0.7}
              height={h}
              rx={0.6}
              className={answered ? "fill-emerald-500/80" : "fill-red-500/45"}
            />
          );
        })}
      </svg>
      <div className="mt-1.5 flex justify-between text-[11px] tabular-nums text-zinc-600">
        <span>-{samples.length}s</span>
        <span>vârf {Math.round(peak)} ms</span>
        <span>acum</span>
      </div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="shrink-0 text-xs text-zinc-500">{label}</span>
      <span className="min-w-0 truncate text-right text-xs font-medium text-zinc-300">
        {value}
      </span>
    </div>
  );
}

export function OfficeServerStatus() {
  const [samples, setSamples] = useState<OfficeHealthSample[]>([]);
  const [info, setInfo] = useState<OfficeServerInfo | null>(null);
  const [paused, setPaused] = useState(false);
  // Ticks once a second so "checked Xs ago" counts up even between polls.
  const [now, setNow] = useState(0);

  // The server's identity, fetched once.
  useEffect(() => {
    void getOfficeServerInfoAction().then(setInfo).catch(() => {});
  }, []);

  // Live polling. Recreated when paused toggles, so a resume samples at once.
  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const s = await getOfficeHealthAction();
        if (alive) setSamples((prev) => [...prev, s].slice(-WINDOW));
      } catch {
        // Ignore a transient failure; the next tick tries again.
      }
    };
    if (!paused) void poll();
    const id = setInterval(() => {
      setNow(Date.now());
      if (!paused && !document.hidden) void poll();
    }, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [paused]);

  const latest = samples[samples.length - 1];
  const state = sampleState(latest);
  const meta = STATE_META[state];

  const answered = samples.filter((s) => s.latencyMs != null);
  const avg =
    answered.length > 0
      ? Math.round(answered.reduce((a, s) => a + (s.latencyMs ?? 0), 0) / answered.length)
      : null;
  const uptime =
    samples.length > 0
      ? Math.round((samples.filter((s) => s.up).length / samples.length) * 100)
      : null;
  const agoS = latest ? Math.max(0, Math.round((now - latest.checkedAt) / 1000)) : null;

  return (
    <div className="rounded-2xl border border-zinc-800/70 bg-zinc-900/40 p-4 sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-zinc-100">
          <Server className="h-5 w-5 text-indigo-400" />
          <h2 className="text-base font-semibold">Status server</h2>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`flex items-center gap-1.5 text-[11px] font-medium ${
              paused ? "text-zinc-500" : "text-emerald-400"
            }`}
          >
            <Activity className="h-3.5 w-3.5" />
            {paused ? "În pauză" : "Live"}
          </span>
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? "Reia monitorizarea" : "Pune pe pauză"}
            className="flex items-center gap-1 rounded-lg border border-zinc-800 px-2 py-1 text-xs text-zinc-300 transition hover:border-zinc-700 hover:text-zinc-50"
          >
            {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Status headline */}
      <div className="mb-4 flex items-center gap-3">
        <span className="relative flex h-3 w-3">
          {state === "up" && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500/60 motion-reduce:hidden" />
          )}
          <span className={`relative inline-flex h-3 w-3 rounded-full ${meta.dot}`} />
        </span>
        <span className={`text-lg font-semibold ${meta.text}`}>{meta.label}</span>
        {latest?.latencyMs != null && (
          <span className="text-sm tabular-nums text-zinc-500">
            {latest.latencyMs} ms
          </span>
        )}
      </div>

      <LatencyGraph samples={samples} />

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric
          label="Latență"
          value={latest?.latencyMs != null ? String(latest.latencyMs) : "—"}
          unit={latest?.latencyMs != null ? "ms" : undefined}
        />
        <Metric label="Medie" value={avg != null ? String(avg) : "—"} unit={avg != null ? "ms" : undefined} />
        <Metric label="Uptime" value={uptime != null ? String(uptime) : "—"} unit={uptime != null ? "%" : undefined} />
        <Metric
          label="Verificat"
          value={agoS != null ? (agoS === 0 ? "acum" : `${agoS}s`) : "—"}
          unit={agoS && agoS > 0 ? "în urmă" : undefined}
        />
      </div>

      {/* Technical metadata */}
      <div className="mt-4 divide-y divide-zinc-800/60 border-t border-zinc-800/60 pt-1">
        <MetaRow label="Nume" value={info?.name ?? "—"} />
        <MetaRow label="Imagine" value={info?.image ?? "—"} />
        <MetaRow label="Versiune" value={info?.version ?? "necunoscută"} />
        <MetaRow label="Container" value={info?.container ?? "—"} />
        <MetaRow label="Adresă" value={info?.url || "neconfigurat"} />
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-zinc-600">
        <RefreshCw className="h-3 w-3" />
        Loguri și status Docker în panou: în curând.
      </p>
    </div>
  );
}
