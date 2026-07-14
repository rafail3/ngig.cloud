"use client";

import { useRef, useState } from "react";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";
import { SpeedMenu } from "./SpeedMenu";

function fmt(s: number): string {
  if (!isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function AudioPlayer({ url }: { url: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const [rate, setRate] = useState(1);
  const [muted, setMuted] = useState(false);
  const [dragging, setDragging] = useState(false);

  function toggle() {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) void a.play();
    else a.pause();
  }

  function scrub(clientX: number) {
    const el = trackRef.current;
    const a = audioRef.current;
    if (!el || !a || !dur) return;
    const rect = el.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    a.currentTime = frac * dur;
    setCur(frac * dur);
  }

  const progress = dur ? (cur / dur) * 100 : 0;

  return (
    <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-zinc-50/15 bg-zinc-50/5 p-4 shadow-xl backdrop-blur-2xl">
      <div className="pointer-events-none absolute -left-8 -top-10 h-32 w-32 rounded-full bg-indigo-500/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-10 -right-8 h-32 w-32 rounded-full bg-violet-500/40 blur-3xl" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-zinc-50/30 to-transparent" />

      <audio
        ref={audioRef}
        src={url}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => !dragging && setCur(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration)}
        onEnded={() => setPlaying(false)}
      />

      {/* timeline */}
      <div
        ref={trackRef}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragging(true);
          scrub(e.clientX);
        }}
        onPointerMove={(e) => dragging && scrub(e.clientX)}
        onPointerUp={(e) => {
          setDragging(false);
          e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        className="relative flex h-5 cursor-pointer touch-none items-center"
      >
        <div className="relative h-1.5 w-full rounded-full bg-zinc-50/20">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-indigo-400 to-violet-400"
            style={{ width: `${progress}%` }}
          />
          <span
            className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow"
            style={{ left: `${progress}%` }}
          />
        </div>
      </div>

      <div className="relative mt-3 flex items-center gap-2.5">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "Pauză" : "Redă"}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-400"
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
        </button>
        <span className="text-xs tabular-nums text-zinc-200">
          {fmt(cur)} / {fmt(dur)}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <SpeedMenu
            rate={rate}
            onChange={(r) => {
              setRate(r);
              if (audioRef.current) audioRef.current.playbackRate = r;
            }}
          />
          <button
            type="button"
            onClick={() => {
              const a = audioRef.current;
              if (!a) return;
              a.muted = !a.muted;
              setMuted(a.muted);
            }}
            aria-label={muted ? "Activează sunet" : "Mut"}
            className="rounded p-1 text-zinc-200 transition hover:text-zinc-50"
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
