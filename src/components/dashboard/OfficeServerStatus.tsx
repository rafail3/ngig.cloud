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
const WINDOW = 60; // samples kept for the graph (~60s of history)
const BASELINE_MS = 120; // graph never shows a scale smaller than this

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

// "3h 12m", "5m 40s", "45s" — for how long the server has held its current state.
function formatDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  const d = Math.floor(h / 24);
  return `${d}z ${h % 24}h`;
}

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

// A heart-monitor trace of recent latency: a continuous line that rises with
// response time, green while the server answers — and, when it stops, drops to
// a red flatline, exactly like an EKG losing its pulse.
const GW = 60; // graph viewBox width (one unit per sample slot)
const GH = 40; // graph viewBox height
const FLATLINE_Y = GH * 0.52; // where a dead server's red flatline sits

function LatencyGraph({ samples }: { samples: OfficeHealthSample[] }) {
  const peak = Math.max(BASELINE_MS, ...samples.map((s) => s.latencyMs ?? 0));

  // Map each sample to a point. Newest sits at the far right; the strip fills in
  // from the right as history builds. An answered sample rises from the bottom
  // with its latency; a dead one sits on the flatline.
  const pts = samples.map((s, i) => {
    const x = GW - (samples.length - 1 - i);
    const up = s.latencyMs != null;
    const y = up
      ? GH - 3 - Math.min(GH - 6, (s.latencyMs! / peak) * (GH - 6))
      : FLATLINE_Y;
    return { x, y, up };
  });

  const head = pts[pts.length - 1];

  return (
    <div className="relative overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3">
      <svg
        viewBox={`0 0 ${GW} ${GH}`}
        preserveAspectRatio="none"
        className="h-20 w-full"
        role="img"
        aria-label={`Timp de răspuns pe ultimele ${samples.length} verificări`}
      >
        {/* Faint monitor grid. */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={0}
            y1={GH * f}
            x2={GW}
            y2={GH * f}
            stroke="currentColor"
            strokeWidth={0.25}
            className="text-zinc-700/40"
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {/* The trace, one segment at a time so each can take its own colour:
            green between two live samples, red the moment the pulse drops. */}
        {pts.slice(1).map((p, i) => {
          const prev = pts[i];
          const alive = p.up && prev.up;
          return (
            <line
              key={p.x}
              x1={prev.x}
              y1={prev.y}
              x2={p.x}
              y2={p.y}
              stroke="currentColor"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              className={alive ? "text-emerald-400" : "text-red-500"}
            />
          );
        })}

        {/* The leading beat — a thin ring that expands and fades where the trace
            ends, so the line's tip stays as thin as the rest (no solid blob). */}
        {head && (
          <circle
            cx={head.x}
            cy={head.y}
            r={1}
            fill="none"
            stroke="currentColor"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
            className={`${head.up ? "text-emerald-300" : "text-red-400"} motion-reduce:hidden`}
          >
            <animate attributeName="r" values="0.6;3.6;0.6" dur="1.1s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.9;0;0.9" dur="1.1s" repeatCount="indefinite" />
          </circle>
        )}
      </svg>
      <div className="mt-1.5 flex justify-between text-[11px] tabular-nums text-zinc-600">
        <span>-{samples.length}s</span>
        <span>vârf {Math.round(peak)} ms</span>
        <span>acum</span>
      </div>
    </div>
  );
}

function MetaRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  // "badge" = highlighted pill (the version); "mono" = code-style tint (image,
  // container); undefined = plain.
  accent?: "badge" | "mono";
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="shrink-0 text-xs text-zinc-500">{label}</span>
      {accent === "badge" ? (
        <span className="inline-flex min-w-0 items-center truncate rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-xs font-semibold text-emerald-300">
          {value}
        </span>
      ) : accent === "mono" ? (
        <span className="min-w-0 truncate text-right font-mono text-xs font-medium text-indigo-300/90">
          {value}
        </span>
      ) : (
        <span className="min-w-0 truncate text-right text-xs font-medium text-zinc-300">
          {value}
        </span>
      )}
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
  // How long the server has held its current up/down state — measured on the
  // server (checkedAt vs since), so it survives page reloads.
  const runMs = latest ? Math.max(0, latest.checkedAt - latest.since) : null;
  // The opposite state's last run: while down, how long it was up before; while
  // up, how long it was down before (if ever recorded).
  const lastOther =
    latest?.state === "up"
      ? latest.lastDownMs != null
        ? { label: "Ultimul downtime", ms: latest.lastDownMs, tone: "text-red-400/80" }
        : null
      : latest?.state === "down"
        ? latest.lastUpMs != null
          ? { label: "Ultimul uptime", ms: latest.lastUpMs, tone: "text-emerald-400/80" }
          : null
        : null;

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
        {latest && runMs != null && (
          <span className="ml-auto text-xs tabular-nums text-zinc-500">
            {latest.state === "up" ? "activ de " : "jos de "}
            <span className="font-medium text-zinc-300">{formatDuration(runMs)}</span>
          </span>
        )}
      </div>

      {lastOther && (
        <p className="-mt-2 mb-4 text-xs tabular-nums text-zinc-500">
          {lastOther.label}:{" "}
          <span className={`font-medium ${lastOther.tone}`}>
            {formatDuration(lastOther.ms)}
          </span>
        </p>
      )}

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
        <MetaRow label="Imagine" value={info?.image ?? "—"} accent="mono" />
        <MetaRow label="Versiune" value={info?.version ?? "necunoscută"} accent="badge" />
        <MetaRow label="Container" value={info?.container ?? "—"} accent="mono" />
        <MetaRow label="Adresă" value={info?.url || "neconfigurat"} />
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-zinc-600">
        <RefreshCw className="h-3 w-3" />
        Loguri și status Docker în panou: în curând.
      </p>
    </div>
  );
}
