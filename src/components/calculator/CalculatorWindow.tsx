"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion, useDragControls, useMotionValue } from "motion/react";
import { Calculator, GripHorizontal, History, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCalculatorEngine } from "./engine";
import { KEYS, type Key } from "./keys";
// KaTeX ships its own stylesheet; without it the typeset line renders as a
// pile of unpositioned spans.
import "katex/dist/katex.min.css";

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
  const { ready, evaluate, typeset } = useCalculatorEngine();
  const [expr, setExpr] = useState("");
  const [history, setHistory] = useState<Entry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [memory, setMemory] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  const panel = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
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
  const math = useMemo(() => (ready ? typeset(expr) : null), [ready, typeset, expr]);

  /* Every key edits AT THE CURSOR. The display is a real input — you can click
     into it, select part of it, drag across it — so appending to the end would
     be wrong the moment the caret is anywhere else. A selection is replaced,
     the way typing does. */
  const editAt = useCallback((make: (before: string, selected: string, after: string) => [string, number]) => {
    const el = input.current;
    const value = el?.value ?? "";
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? start;
    const [next, caret] = make(value.slice(0, start), value.slice(start, end), value.slice(end));
    setExpr(next);
    // After React has written the new value: setting it first would put the
    // caret at the end, which is exactly what this exists to avoid.
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(caret, caret);
    });
  }, []);

  const insert = useCallback(
    (text: string) => editAt((b, _s, a) => [b + text + a, b.length + text.length]),
    [editAt],
  );

  const backspace = useCallback(
    () =>
      editAt((b, sel, a) =>
        // A selection is what gets deleted, if there is one.
        sel ? [b + a, b.length] : [b.slice(0, -1) + a, Math.max(0, b.length - 1)],
      ),
    [editAt],
  );

  const commit = useCallback(() => {
    const r = evaluate(expr);
    if (!r.ok) return;
    setHistory((h) => [{ expr, value: r.value }, ...h].slice(0, 30));
    // The result becomes the next starting point, the way a calculator does —
    // so you can keep operating on what you just worked out.
    setExpr(r.value);
    requestAnimationFrame(() => {
      const el = input.current;
      el?.focus();
      el?.setSelectionRange(r.value.length, r.value.length);
    });
  }, [evaluate, expr]);

  const press = useCallback(
    (k: Key) => {
      if ("insert" in k) {
        insert(k.insert);
        return;
      }
      if ("mem" in k) {
        // What goes into memory is the value of what is on screen, so M+ works
        // on a whole expression and not just on a number you typed.
        const current = evaluate(expr);
        const n = current.ok ? Number(current.value) : NaN;
        if (k.mem === "MC") setMemory(null);
        if (k.mem === "MR" && memory !== null) insert(String(memory));
        if (k.mem === "M+" && Number.isFinite(n)) setMemory((m) => (m ?? 0) + n);
        if (k.mem === "M-" && Number.isFinite(n)) setMemory((m) => (m ?? 0) - n);
        return;
      }
      if (k.cmd === "clear") {
        setExpr("");
        input.current?.focus();
      }
      if (k.cmd === "back") backspace();
      if (k.cmd === "equals") commit();
      // These two wrap the WHOLE expression rather than hunting for the last
      // operand — wrapping is unambiguous whatever you have typed.
      if (k.cmd === "sign") setExpr((e) => (e ? `-(${e})` : "-"));
      if (k.cmd === "recip") setExpr((e) => (e ? `1/(${e})` : e));
    },
    [backspace, commit, evaluate, expr, insert, memory],
  );

  /* The input does ordinary typing itself — that is the point of it being a
     real input rather than a rendered line — so only the calculator's own keys
     are intercepted here. Nothing is bound globally: the document underneath
     is live, and a window-level listener would steal its keystrokes. */
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        // The preview underneath closes on Escape too. Closing the calculator
        // is what the key meant while it was open, so it stops here.
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === "Enter" || (e.key === "=" && !e.shiftKey)) {
        e.preventDefault();
        commit();
        return;
      }
      if (e.key === "Delete") {
        // Delete is the calculator's "clear everything", the way AC is on a
        // physical one — not the forward-delete a text field would give you.
        e.preventDefault();
        setExpr("");
      }
    },
    [commit, onClose],
  );

  useEffect(() => {
    input.current?.focus();
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

        {/* Three lines, and each earns its place.

            Typeset: the expression as real mathematics — a radical drawn over
            its operand, a raised exponent, π, a fraction bar, a degree sign.
            mathjs emits the LaTeX from its own parse tree and KaTeX draws it,
            so nothing here is a hand-written symbol substitution. It appears
            only once the expression parses, which is not while you are halfway
            through typing one.

            Source: a real input. You can click into it, select part of it,
            drag across it, and every key on the pad edits at the caret.

            Result: dim, because it is a preview and not a committed answer. */}
        <div className="px-3 pb-2.5 pt-3 text-right">
          {math && (
            <div
              className="mb-1 max-w-full overflow-x-auto overflow-y-hidden text-lg leading-tight text-zinc-100 [&_.katex]:text-[1em]"
              dangerouslySetInnerHTML={{ __html: math }}
            />
          )}
          <Input
            ref={input}
            variant="unstyled"
            value={expr}
            onChange={(e) => setExpr(e.target.value)}
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            aria-label="Expresie"
            placeholder="0"
            className={`w-full bg-transparent text-right tabular-nums outline-none placeholder:text-zinc-600 ${
              math ? "text-xs text-zinc-500" : "text-lg font-medium text-zinc-100"
            }`}
          />
          <p className="mt-0.5 min-h-4 truncate text-xs tabular-nums text-zinc-500">
            {!ready
              ? "Se încarcă…"
              : liveValue !== null && liveValue !== expr
                ? `= ${liveValue}`
                : ""}
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
