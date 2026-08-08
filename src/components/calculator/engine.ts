"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* The maths is mathjs, not ours. It brings operator precedence, parentheses,
   trigonometry, logarithms, roots and powers already correct, and two things
   that are easy to get wrong by hand:

   - `format(value, { precision })` reports 0.1 + 0.2 as 0.3 rather than
     0.30000000000000004. A calculator that prints float noise looks broken.
   - `sin(45 deg)` is understood natively, units and all, at any nesting depth.
     That is why the keypad has a `deg` key rather than a DEG/RAD mode: the
     unit travels with the number the way it does on paper, instead of a
     hidden global that silently changes what an old history entry meant.

   It loads on first open, not with the page. mathjs is a large library and
   nothing about the drive needs it until someone asks for a calculator. */

type MathModule = typeof import("mathjs");

let pending: Promise<MathModule> | null = null;
function loadMath(): Promise<MathModule> {
  pending ??= import("mathjs");
  return pending;
}

export type EvalResult = { ok: true; value: string } | { ok: false; error: string };

export function useCalculatorEngine() {
  const math = useRef<MathModule | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    void loadMath().then((m) => {
      if (!alive) return;
      math.current = m;
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const evaluate = useCallback((expression: string): EvalResult => {
    const m = math.current;
    if (!m) return { ok: false, error: "Se încarcă…" };
    const expr = expression.trim();
    if (!expr) return { ok: false, error: "" };
    try {
      const value: unknown = m.evaluate(expr);
      // An assignment or a bare function definition evaluates to something
      // there is nothing useful to show for.
      if (value === undefined || typeof value === "function") {
        return { ok: false, error: "" };
      }
      // 12 significant digits: enough for real work, short of the range where
      // binary floating point starts printing its own rounding error.
      return { ok: true, value: m.format(value, { precision: 12 }) };
    } catch {
      // Half-typed expressions throw constantly while the live preview runs.
      // The caller decides whether that is worth showing.
      return { ok: false, error: "Expresie invalidă" };
    }
  }, []);

  return { ready, evaluate };
}
