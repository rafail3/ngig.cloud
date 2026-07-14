"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize } from "lucide-react";
import { SpeedMenu } from "./SpeedMenu";

function fmt(s: number): string {
  if (!isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function VideoPlayer({
  url,
  onReady,
}: {
  url: string;
  onReady?: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const glowRef = useRef<HTMLCanvasElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const [rate, setRate] = useState(1);
  const [muted, setMuted] = useState(false);
  const [dragging, setDragging] = useState(false);

  // Ambilight: paint a tiny blurred copy of the current frame behind the video,
  // so its colours spill onto the glass margins and move with the playback.
  useEffect(() => {
    const canvas = glowRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const c = canvas.getContext("2d");
    if (!c) return;
    const render = () => {
      rafRef.current = requestAnimationFrame(render);
      if (video.readyState >= 2) {
        try {
          c.drawImage(video, 0, 0, canvas.width, canvas.height);
        } catch {
          /* ignore */
        }
      }
    };
    render();
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  function toggle() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  }

  function scrub(clientX: number) {
    const el = barRef.current;
    const v = videoRef.current;
    if (!el || !v || !dur) return;
    const rect = el.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    v.currentTime = frac * dur;
    setCur(frac * dur);
  }

  function fullscreen() {
    void wrapRef.current?.requestFullscreen?.();
  }

  const progress = dur ? (cur / dur) * 100 : 0;

  return (
    <div
      ref={wrapRef}
      className={`relative inline-flex max-w-full flex-col gap-2 overflow-hidden rounded-3xl border border-zinc-50/10 p-2 sm:p-2.5 ${
        ready ? "" : "invisible"
      }`}
    >
      {/* ambient glow backdrop (blurred video frame) */}
      <canvas
        ref={glowRef}
        width={48}
        height={27}
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full scale-110 blur-2xl saturate-150"
      />

      <video
        ref={videoRef}
        src={url}
        crossOrigin="anonymous"
        preload="auto"
        onClick={toggle}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onCanPlay={() => {
          setReady(true);
          onReady?.();
        }}
        onTimeUpdate={(e) => !dragging && setCur(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration)}
        onEnded={() => setPlaying(false)}
        className={
          ready
            ? "relative z-10 mx-auto block max-h-[68vh] w-auto max-w-full rounded-2xl"
            : "pointer-events-none absolute h-px w-px opacity-0"
        }
      />

      {ready && (
        <div className="relative z-10 rounded-2xl border border-zinc-50/10 bg-zinc-950/40 px-3 py-2 backdrop-blur-xl">
          {/* draggable timeline */}
          <div
            ref={barRef}
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
            className="flex h-4 cursor-pointer touch-none items-center"
          >
            <div className="relative h-1.5 w-full rounded-full bg-zinc-50/25">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-indigo-500"
                style={{ width: `${progress}%` }}
              />
              <span
                className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow"
                style={{ left: `${progress}%` }}
              />
            </div>
          </div>

          <div className="mt-1.5 flex items-center gap-3 text-zinc-100">
            <button type="button" onClick={toggle} aria-label={playing ? "Pauză" : "Redă"}>
              {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </button>
            <button
              type="button"
              onClick={() => {
                const v = videoRef.current;
                if (!v) return;
                v.muted = !v.muted;
                setMuted(v.muted);
              }}
              aria-label={muted ? "Activează sunet" : "Mut"}
            >
              {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </button>
            <span className="text-xs tabular-nums text-zinc-200">
              {fmt(cur)} / {fmt(dur)}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <SpeedMenu
                dark
                rate={rate}
                onChange={(r) => {
                  setRate(r);
                  if (videoRef.current) videoRef.current.playbackRate = r;
                }}
              />
              <button type="button" onClick={fullscreen} aria-label="Ecran complet">
                <Maximize className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
