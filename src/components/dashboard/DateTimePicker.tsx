"use client";

import { useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { useClickOutside } from "@/lib/useClickOutside";

const WEEKDAYS = ["Lu", "Ma", "Mi", "Jo", "Vi", "Sâ", "Du"];
const MONTHS = [
  "ianuarie", "februarie", "martie", "aprilie", "mai", "iunie",
  "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie",
];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
// "YYYY-MM-DDTHH:mm" in local time (same shape as a datetime-local input).
function toLocalString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalString(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function sameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

function clamp(min: number, max: number, v: number): number {
  if (Number.isNaN(v)) return min;
  return Math.max(min, Math.min(max, v));
}

// A 2-digit time field. Shows the padded value ("00") when idle; clears on focus
// so you type the number directly.
function TimeField({
  value,
  max,
  onCommit,
  ariaLabel,
}: {
  value: number;
  max: number;
  onCommit: (v: number) => void;
  ariaLabel: string;
}) {
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState("");
  return (
    <input
      type="text"
      inputMode="numeric"
      maxLength={2}
      aria-label={ariaLabel}
      value={focused ? text : pad(value)}
      onFocus={(e) => {
        setFocused(true);
        setText("");
        e.target.select();
      }}
      onChange={(e) => {
        const v = e.target.value.replace(/\D/g, "").slice(0, 2);
        setText(v);
        onCommit(v === "" ? 0 : clamp(0, max, parseInt(v, 10)));
      }}
      onBlur={() => setFocused(false)}
      className="w-8 bg-transparent text-center text-sm tabular-nums text-zinc-100 focus:outline-none"
    />
  );
}

export function DateTimePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  // Captured on open (never during render — the compiler lint forbids new Date()
  // in render). Drives "today" highlighting and past-date disabling.
  const [now, setNow] = useState<Date | null>(null);
  const [view, setView] = useState<{ y: number; m: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false), open);

  const selected = fromLocalString(value);
  const hh = selected ? selected.getHours() : 0;
  const mm = selected ? selected.getMinutes() : 0;

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    const n = new Date();
    setNow(n);
    const base = selected ?? n;
    setView({ y: base.getFullYear(), m: base.getMonth() });
    setOpen(true);
  }

  function pickDay(day: Date) {
    const base = selected ?? now ?? new Date();
    const h = base.getHours();
    const min = selected ? selected.getMinutes() : 0;
    onChange(toLocalString(new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, min)));
  }
  function setTime(h: number, min: number) {
    const base = selected ?? now ?? new Date();
    onChange(toLocalString(new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, min)));
  }

  function shiftMonth(delta: number) {
    if (!view) return;
    const d = new Date(view.y, view.m + delta, 1);
    setView({ y: d.getFullYear(), m: d.getMonth() });
  }

  const label = selected
    ? selected.toLocaleString("ro-RO", { dateStyle: "medium", timeStyle: "short" })
    : "Alege data și ora";

  return (
    <div ref={ref} className="relative w-full sm:w-72">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className={`flex w-full items-center gap-2 rounded-lg border bg-zinc-950 px-3.5 py-2 text-left text-sm transition ${
          open ? "border-indigo-500/60" : "border-zinc-800 hover:border-zinc-700"
        } ${selected ? "text-zinc-100" : "text-zinc-500"}`}
      >
        <Calendar className="h-4 w-4 shrink-0 text-zinc-500" />
        <span className="truncate">{label}</span>
      </button>

      {open && now && view && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="relative max-h-[85vh] w-[20rem] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-900 p-3 shadow-2xl">
          {/* Month nav */}
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="rounded-md p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
              aria-label="Luna anterioară"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-medium capitalize text-zinc-100">
              {MONTHS[view.m]} {view.y}
            </span>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="rounded-md p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
              aria-label="Luna următoare"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Weekday header */}
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-zinc-500">
            {WEEKDAYS.map((w) => (
              <span key={w} className="py-1">
                {w}
              </span>
            ))}
          </div>

          {/* Day grid */}
          <DayGrid
            year={view.y}
            month={view.m}
            now={now}
            selected={selected}
            onPick={pickDay}
          />

          {/* Time — any hour/minute, compact typed inputs */}
          <div className="mt-3 flex items-center gap-2 border-t border-zinc-800 pt-3">
            <Clock className="h-4 w-4 shrink-0 text-zinc-500" />
            <div className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 focus-within:border-indigo-500/60">
              <TimeField value={hh} max={23} ariaLabel="Ora" onCommit={(h) => setTime(h, mm)} />
              <span className="text-zinc-500">:</span>
              <TimeField value={mm} max={59} ariaLabel="Minutul" onCommit={(m) => setTime(hh, m)} />
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="ml-auto rounded-md bg-indigo-600 px-3.5 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-500"
            >
              Gata
            </button>
          </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DayGrid({
  year,
  month,
  now,
  selected,
  onPick,
}: {
  year: number;
  month: number;
  now: Date;
  selected: Date | null;
  onPick: (d: Date) => void;
}) {
  const first = new Date(year, month, 1);
  // Monday-first offset (JS getDay: 0=Sun).
  const offset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = startOfDay(now);

  const cells: (Date | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="mt-1 grid grid-cols-7 gap-1">
      {cells.map((d, i) => {
        if (!d) return <span key={i} />;
        const past = startOfDay(d).getTime() < today.getTime();
        const isToday = sameDay(d, now);
        const isSel = selected != null && sameDay(d, selected);
        return (
          <button
            key={i}
            type="button"
            disabled={past}
            onClick={() => onPick(d)}
            className={`flex h-8 items-center justify-center rounded-md text-sm transition ${
              isSel
                ? "bg-indigo-600 font-semibold text-white"
                : past
                  ? "cursor-not-allowed text-zinc-700"
                  : `text-zinc-200 hover:bg-zinc-800 ${isToday ? "ring-1 ring-inset ring-indigo-500/50" : ""}`
            }`}
          >
            {d.getDate()}
          </button>
        );
      })}
    </div>
  );
}
