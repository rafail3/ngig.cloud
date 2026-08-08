"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toMath } from "./keys";

/* The maths is mathjs. It brings operator precedence, parentheses,
   trigonometry, logarithms, roots and powers already correct, plus two things
   that are easy to get wrong by hand:

   - `format(value, { precision })` reports 0.1 + 0.2 as 0.3 rather than
     0.30000000000000004. A calculator that prints float noise looks broken.
   - `sin(45 deg)` is understood natively, at any nesting depth. That is what
     the `°` key writes, so an angle carries its unit instead of depending on a
     hidden mode that would silently reinterpret an old history entry.

   What reaches it is never what is on screen: the display holds `√`, `π`, `×`,
   `÷`, `−`, `°`, and `toMath` turns those back into source at the moment of
   evaluation. There was a version of this with a typeset second line, and it
   was wrong — the caret can only live in one of the two lines, so the other is
   always either stale or a duplicate. One line, with the symbols in it.

   mathjs loads on first open. Nothing about the drive needs a maths library
   until someone asks for a calculator. */

type MathModule = typeof import("mathjs");

let pending: Promise<MathModule> | null = null;
function load() {
  pending ??= import("mathjs");
  return pending;
}

export type EvalResult = { ok: true; value: string } | { ok: false; error: string };

export function useCalculatorEngine() {
  const math = useRef<MathModule | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    void load().then((m) => {
      if (!alive) return;
      math.current = m;
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const evaluate = useCallback((display: string): EvalResult => {
    const m = math.current;
    if (!m) return { ok: false, error: "Se încarcă…" };
    const expr = toMath(display).trim();
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
      return { ok: false, error: "Expresie invalidă" };
    }
  }, []);

  return { ready, evaluate };
}
