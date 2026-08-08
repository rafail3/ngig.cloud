"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* The maths is mathjs and the typesetting is KaTeX. Neither is ours, and the
   seam between them is the good part: mathjs can emit LaTeX from its OWN parse
   tree, so `sqrt(16)+pi^2` becomes `\sqrt{16}+{\pi}^{2}` without a single line
   of hand-written conversion. One library parses, the other draws.

   That is what puts a real radical sign over the operand, a raised exponent, a
   π, a proper fraction bar and a degree symbol into the display, instead of the
   word "sqrt".

   mathjs also brings two things that are easy to get wrong by hand:

   - `format(value, { precision })` reports 0.1 + 0.2 as 0.3 rather than
     0.30000000000000004. A calculator that prints float noise looks broken.
   - `sin(45 deg)` is understood natively, at any nesting depth. That is why
     the keypad has a `deg` key rather than a DEG/RAD mode: the unit travels
     with the number, so an old history entry still means what it said.

   Both load on first open. Nothing about the drive needs a maths library or a
   typesetter until someone asks for a calculator. */

type MathModule = typeof import("mathjs");
type KatexModule = typeof import("katex");

let pending: Promise<[MathModule, KatexModule]> | null = null;
function load() {
  pending ??= Promise.all([import("mathjs"), import("katex")]);
  return pending;
}

export type EvalResult = { ok: true; value: string } | { ok: false; error: string };

export function useCalculatorEngine() {
  const libs = useRef<[MathModule, KatexModule] | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    void load().then((l) => {
      if (!alive) return;
      libs.current = l;
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const evaluate = useCallback((expression: string): EvalResult => {
    const math = libs.current?.[0];
    if (!math) return { ok: false, error: "Se încarcă…" };
    const expr = expression.trim();
    if (!expr) return { ok: false, error: "" };
    try {
      const value: unknown = math.evaluate(expr);
      // An assignment or a bare function definition evaluates to something
      // there is nothing useful to show for.
      if (value === undefined || typeof value === "function") {
        return { ok: false, error: "" };
      }
      // 12 significant digits: enough for real work, short of the range where
      // binary floating point starts printing its own rounding error.
      return { ok: true, value: math.format(value, { precision: 12 }) };
    } catch {
      // Half-typed expressions throw constantly while the live preview runs.
      return { ok: false, error: "Expresie invalidă" };
    }
  }, []);

  /** The expression as typeset maths, or null while it cannot be parsed —
   *  which is most of the time you are halfway through typing one. */
  const typeset = useCallback((expression: string): string | null => {
    const [math, katex] = libs.current ?? [];
    if (!math || !katex || !expression.trim()) return null;
    try {
      return katex.renderToString(math.parse(expression).toTex(), {
        throwOnError: true,
        output: "html",
      });
    } catch {
      return null;
    }
  }, []);

  return { ready, evaluate, typeset };
}
