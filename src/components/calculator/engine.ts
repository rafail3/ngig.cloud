"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { asciiToMath } from "./keys";

/* Three libraries, each doing the one thing it is best at, and no parser of
   our own anywhere in the chain:

     MathLive   edits and renders the maths, and converts its LaTeX to
                ASCIIMath — so what is on screen is real typeset notation with
                a caret inside it, not text pretending to be maths.
     asciiToMath renames the handful of tokens ASCIIMath and mathjs spell
                differently. Five rules, each one added because a test failed.
     mathjs     evaluates. It brings precedence, parentheses, trigonometry,
                logarithms, roots and powers already correct, plus two things
                that are easy to get wrong by hand:

                  `format(value, { precision })` reports 0.1 + 0.2 as 0.3
                  rather than 0.30000000000000004 — a calculator that prints
                  float noise looks broken;

                  `sin(45 deg)` is understood natively at any nesting depth,
                  which is what lets the keypad have a `°` key instead of a
                  hidden DEG/RAD mode that would silently reinterpret an old
                  history entry.

   Both load on first open. Nothing about the drive needs a maths library or a
   typesetter until someone asks for a calculator. */

type MathModule = typeof import("mathjs");
type MathLive = typeof import("mathlive");

let pending: Promise<[MathModule, MathLive]> | null = null;
function load() {
  pending ??= Promise.all([import("mathjs"), import("mathlive")]);
  return pending;
}

export type EvalResult = { ok: true; value: string } | { ok: false; error: string };

export function useCalculatorEngine() {
  const libs = useRef<[MathModule, MathLive] | null>(null);
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

  /** Evaluate what the mathfield holds. Takes LaTeX, because that is what a
   *  mathfield speaks. */
  const evaluate = useCallback((latex: string): EvalResult => {
    const [math, ml] = libs.current ?? [];
    if (!math || !ml) return { ok: false, error: "Se încarcă…" };
    if (!latex.trim()) return { ok: false, error: "" };
    try {
      const expr = asciiToMath(ml.convertLatexToAsciiMath(latex)).trim();
      if (!expr) return { ok: false, error: "" };
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

  /** Typeset a fragment for display OUTSIDE the field — the keypad labels.
   *  Needs /mathlive/mathlive-static.css, which MathField injects. */
  const markup = useCallback((tex: string): string | null => {
    const ml = libs.current?.[1];
    if (!ml) return null;
    try {
      return ml.convertLatexToMarkup(tex);
    } catch {
      return null;
    }
  }, []);

  return { ready, evaluate, markup };
}
