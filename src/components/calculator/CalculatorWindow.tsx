"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion, useDragControls, useMotionValue } from "motion/react";
import { Calculator, GripHorizontal, History, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCalculatorEngine } from "./engine";
import { KEYS, TYPED, type Key } from "./keys";

const WIDTH = 288; // w-72
const MARGIN = 24;
const POS_KEY = "ngig.calculator.pos";

type Entry = { expr: string; value: string };

/* A calculator that floats over a document instead of replacing it — the whole
   point is to work out a number WHILE looking at the sheet, so it is a small
   window you can shove aside, not a full-screen takeover.

   Motion supplies the dragging. Two things it does not supply:

   - A drag that crosses an iframe dies. The Office editor IS an iframe, and an
     iframe swallows the pointer events the drag is listening for, so the
     window would stick the moment the cursor entered the document. A
     transparent sheet is laid over everything for the duration of the drag,
     and the events land on that instead.
   - Where you left it. The position is kept per browser, so the calculator
     reopens where you last put it rather than jumping back to the corner. */

export function CalculatorWindow({ onClose }: { onClose: () => void }) {
  const { ready, evaluate } = useCalculatorEngine();
  const [expr, setExpr] = useState("");
  const [history, setHistory] = useState<Entry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [memory, setMemory] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  const panel = useRef<HTMLDivElement>(null);
  // Drag limits in the window's OWN coordinate space. It is positioned against
  // whatever its offsetParent turns out to be, which differs per host: the
  // Office editor's root covers the viewport, while the preview's panel is a
  // box in the middle of it (a Dialog carries a `translate`, and a translated
  // element becomes the containing block for everything positioned inside it).
  // Measuring the offsetParent means the same window works in both without
  // being told where it is.
  const [limits, setLimits] = useState({ left: 0, top: 0, right: 0, bottom: 0 });
  const controls = useDragControls();
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Restore the last position, clamped to the viewport this time — a window
  // remembered at the edge of a wide monitor must not open off-screen on a
  // laptop. Default is the bottom-right corner, out of the way of a toolbar.
  useLayoutEffect(() => {
    const el = panel.current;
    if (!el) return;
    const h = el.offsetHeight || 420;
    // Origin of this window's coordinate space, in viewport terms.
    const host = (el.offsetParent as HTMLElement | null)?.getBoundingClientRect();
    const ox = host?.left ?? 0;
    const oy = host?.top ?? 0;

    // Viewport-space box the window is allowed to occupy, then shifted into
    // local space. Negative values are normal and correct: they are how the
    // window reaches the parts of the screen outside its host.
    const box = {
      left: MARGIN - ox,
      top: MARGIN - oy,
      right: window.innerWidth - WIDTH - MARGIN - ox,
      bottom: window.innerHeight - h - MARGIN - oy,
    };
    setLimits(box);

    // Stored in viewport coordinates so the position survives being reopened
    // from a different host, and clamped on the way in — a window remembered
    // at the edge of a wide monitor must not open off-screen on a laptop.
    let vx = window.innerWidth - WIDTH - MARGIN;
    let vy = window.innerHeight - h - MARGIN;
    try {
      const saved = localStorage.getItem(POS_KEY);
      if (saved) {
        const p = JSON.parse(saved) as { x: number; y: number };
        if (Number.isFinite(p.x) && Number.isFinite(p.y)) {
          vx = Math.min(Math.max(MARGIN, p.x), window.innerWidth - WIDTH - MARGIN);
          vy = Math.min(Math.max(MARGIN, p.y), window.innerHeight - h - MARGIN);
        }
      }
    } catch {
      // A corrupt entry is not worth failing to open over.
    }
    x.set(vx - ox);
    y.set(vy - oy);
  }, [x, y]);

  const preview = useMemo(() => (ready ? evaluate(expr) : null), [ready, evaluate, expr]);
  const liveValue = preview?.ok ? preview.value : null;

  const commit = useCallback(() => {
    const r = evaluate(expr);
    if (!r.ok) return;
    setHistory((h) => [{ expr, value: r.value }, ...h].slice(0, 30));
    // The result becomes the next starting point, the way a calculator does —
    // so you can keep operating on what you just worked out.
    setExpr(r.value);
  }, [evaluate, expr]);

  const press = useCallback(
    (k: Key) => {
      if ("insert" in k) {
        setExpr((e) => e + k.insert);
        return;
      }
      if ("mem" in k) {
        const current = evaluate(expr);
        const n = current.ok ? Number(current.value) : NaN;
        if (k.mem === "MC") setMemory(null);
        if (k.mem === "MR" && memory !== null) setExpr((e) => e + String(memory));
        if (k.mem === "M+" && Number.isFinite(n)) setMemory((m) => (m ?? 0) + n);
        if (k.mem === "M-" && Number.isFinite(n)) setMemory((m) => (m ?? 0) - n);
        return;
      }
      if (k.cmd === "clear") setExpr("");
      if (k.cmd === "back") setExpr((e) => e.slice(0, -1));
      if (k.cmd === "equals") commit();
      // Both of these wrap what is already there, rather than trying to find
      // the last operand — wrapping is unambiguous whatever you have typed.
      if (k.cmd === "sign") setExpr((e) => (e ? `-(${e})` : "-"));
      if (k.cmd === "recip") setExpr((e) => (e ? `1/(${e})` : e));
    },
    [commit, evaluate, expr, memory],
  );

  // Typing is scoped to the window: the Office editor underneath is a live
  // document, and a global listener would steal its keystrokes.
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        // The preview underneath closes on Escape too. Closing the calculator
        // is what this key meant here, so it stops at this window.
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === "Enter" || e.key === "=") {
        e.preventDefault();
        commit();
        return;
      }
      if (e.key === "Backspace") {
        e.preventDefault();
        setExpr((v) => v.slice(0, -1));
        return;
      }
      if (e.key.length === 1 && TYPED.has(e.key)) {
        e.preventDefault();
        setExpr((v) => v + e.key);
      }
    },
    [commit, onClose],
  );

  useEffect(() => {
    panel.current?.focus();
  }, []);

  return (
    <>
      {/* The sheet that keeps a drag alive across the Office iframe. Only
          present while dragging, so it never blocks the document. */}
      {dragging && <div className="fixed inset-0 z-[69] cursor-grabbing" />}

      <motion.div
        ref={panel}
        drag
        dragControls={controls}
        // Only the title bar starts a drag; the keypad must stay clickable.
        dragListener={false}
        dragConstraints={limits}
        dragMomentum={false}
        dragElastic={0}
        onDragStart={() => setDragging(true)}
        onDragEnd={() => {
          setDragging(false);
          try {
            const host = (panel.current?.offsetParent as HTMLElement | null)?.getBoundingClientRect();
            localStorage.setItem(
              POS_KEY,
              JSON.stringify({ x: x.get() + (host?.left ?? 0), y: y.get() + (host?.top ?? 0) }),
            );
          } catch {
            // Private mode — the window simply will not be remembered.
          }
        }}
        style={{ x, y, width: WIDTH }}
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 30, mass: 0.8 }}
        tabIndex={-1}
        role="dialog"
        aria-label="Calculator"
        onKeyDown={onKeyDown}
        className="absolute left-0 top-0 z-[70] overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl shadow-black/50 outline-none"
      >
        {/* Title bar — the drag handle. `touch-none` so a drag on a tablet
            moves the window instead of scrolling the page behind it. */}
        <div
          onPointerDown={(e) => controls.start(e)}
          className="flex touch-none cursor-grab select-none items-center gap-2 border-b border-zinc-800 bg-zinc-900 px-3 py-2 active:cursor-grabbing"
        >
          <GripHorizontal className="size-4 shrink-0 text-zinc-600" />
          <span className="flex-1 text-xs font-medium text-zinc-300">Calculator</span>
          {memory !== null && (
            <span
              title={`În memorie: ${memory}`}
              className="rounded bg-indigo-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-300"
            >
              M
            </span>
          )}
          <Button
            variant="unstyled"
            type="button"
            onClick={() => setShowHistory((s) => !s)}
            aria-label="Istoric"
            aria-expanded={showHistory}
            title="Istoric"
            className={`rounded p-1 transition-colors hover:bg-zinc-800 ${
              showHistory ? "bg-zinc-800 text-zinc-100" : "text-zinc-400"
            }`}
          >
            <History className="size-3.5" />
          </Button>
          <Button
            variant="unstyled"
            type="button"
            onClick={onClose}
            aria-label="Închide calculatorul"
            title="Închide"
            className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
          >
            <X className="size-3.5" />
          </Button>
        </div>

        {showHistory && (
          <div className="max-h-32 overflow-y-auto border-b border-zinc-800 bg-zinc-950/40">
            {history.length === 0 ? (
              <p className="px-3 py-4 text-center text-[11px] text-zinc-600">Niciun calcul încă.</p>
            ) : (
              history.map((h, i) => (
                <Button
                  key={`${h.expr}-${i}`}
                  variant="unstyled"
                  type="button"
                  // Reuse the RESULT, not the expression: the reason to reach
                  // back is almost always the number you arrived at.
                  onClick={() => setExpr((e) => e + h.value)}
                  title={`${h.expr} = ${h.value}`}
                  className="flex w-full items-baseline justify-between gap-2 px-3 py-1.5 text-left transition-colors hover:bg-zinc-800/60"
                >
                  <span className="min-w-0 flex-1 truncate text-[11px] text-zinc-500">{h.expr}</span>
                  <span className="shrink-0 text-xs font-medium text-zinc-200">{h.value}</span>
                </Button>
              ))
            )}
          </div>
        )}

        {/* Display: what you typed on top, what it comes to underneath. The
            live line is dim because it is a preview, not a committed answer. */}
        <div className="px-3 py-3 text-right">
          <p
            dir="ltr"
            className="min-h-6 truncate text-lg font-medium tabular-nums text-zinc-100"
            title={expr}
          >
            {expr || <span className="text-zinc-600">0</span>}
          </p>
          <p className="mt-0.5 min-h-4 truncate text-xs tabular-nums text-zinc-500">
            {!ready ? "Se încarcă…" : liveValue !== null && liveValue !== expr ? `= ${liveValue}` : ""}
          </p>
        </div>

        <div className="grid grid-cols-5 gap-px bg-zinc-800/70 p-px">
          {KEYS.map((k) => (
            <Button
              key={k.label}
              variant="unstyled"
              type="button"
              disabled={!ready}
              onClick={() => press(k)}
              title={k.title}
              className={`h-10 select-none bg-zinc-900 text-sm transition-colors hover:bg-zinc-800 disabled:opacity-40 ${
                "cmd" in k && k.cmd === "equals"
                  ? "bg-indigo-500 font-semibold text-white hover:bg-indigo-400"
                  : k.kind === "num"
                    ? "font-medium text-zinc-100"
                    : k.kind === "fn"
                      ? "text-[13px] text-indigo-300"
                      : "text-zinc-300"
              }`}
            >
              {k.label}
            </Button>
          ))}
        </div>
      </motion.div>
    </>
  );
}

/** Toolbar trigger. Kept separate from the window because the button belongs
 *  inside a panel that clips its children, and the window must not be. */
export function CalculatorButton({
  open,
  onToggle,
  className,
}: {
  open: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <Button
      variant="unstyled"
      type="button"
      onClick={onToggle}
      aria-label="Calculator"
      aria-expanded={open}
      title="Calculator"
      className={className}
    >
      <Calculator className="size-4" />
    </Button>
  );
}
