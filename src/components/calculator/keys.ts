/* The keypad, as data. Five columns, so every row below is five entries.

   What a key inserts is LaTeX, because the display is a MathLive field: `√`
   arrives as a real radical sign with its operand under the bar, `^` as a
   raised exponent, `π` as π. There is no symbol substitution to maintain and
   no second line to keep in step — the field IS the rendered maths, and the
   caret lives inside it.

   `#0` is MathLive's placeholder for the current selection, so pressing √ with
   something selected puts it under the radical; `#?` is an empty slot the
   caret jumps into. */

type Base = { label: string; kind?: "num" | "op" | "fn"; title?: string };

export type Key =
  | (Base & { latex: string })
  | (Base & { cmd: "clear" | "back" | "equals" })
  | (Base & { mem: "MC" | "MR" | "M+" | "M-" });

export const KEYS: Key[] = [
  { label: "MC", mem: "MC", kind: "op", title: "Golește memoria" },
  { label: "MR", mem: "MR", kind: "op", title: "Cheamă memoria" },
  { label: "M+", mem: "M+", kind: "op", title: "Adună în memorie" },
  { label: "M−", mem: "M-", kind: "op", title: "Scade din memorie" },
  { label: "C", cmd: "clear", kind: "op", title: "Șterge tot" },

  { label: "sin", latex: "\\sin(#0)", kind: "fn" },
  { label: "cos", latex: "\\cos(#0)", kind: "fn" },
  { label: "tan", latex: "\\tan(#0)", kind: "fn" },
  // A degree sign, not a mode toggle: the unit rides along with the number, so
  // sin(45°) still means 45 degrees when you read it back out of the history.
  { label: "°", latex: "\\degree", kind: "fn", title: "Grade (ex. sin(45°))" },
  { label: "⌫", cmd: "back", kind: "op", title: "Șterge un caracter" },

  { label: "ln", latex: "\\ln(#0)", kind: "fn", title: "Logaritm natural" },
  { label: "log", latex: "\\log_{10}(#0)", kind: "fn", title: "Logaritm în bază 10" },
  { label: "√", latex: "\\sqrt{#0}", kind: "fn", title: "Radical" },
  { label: "xʸ", latex: "#0^{#?}", kind: "fn", title: "Ridicare la putere" },
  { label: "¹⁄ₓ", latex: "\\frac{1}{#0}", kind: "fn", title: "Inversul valorii" },

  { label: "7", latex: "7", kind: "num" },
  { label: "8", latex: "8", kind: "num" },
  { label: "9", latex: "9", kind: "num" },
  { label: "(", latex: "(", kind: "op" },
  { label: ")", latex: ")", kind: "op" },

  { label: "4", latex: "4", kind: "num" },
  { label: "5", latex: "5", kind: "num" },
  { label: "6", latex: "6", kind: "num" },
  { label: "×", latex: "\\times", kind: "op" },
  { label: "÷", latex: "\\div", kind: "op" },

  { label: "1", latex: "1", kind: "num" },
  { label: "2", latex: "2", kind: "num" },
  { label: "3", latex: "3", kind: "num" },
  { label: "+", latex: "+", kind: "op" },
  { label: "−", latex: "-", kind: "op" },

  { label: "0", latex: "0", kind: "num" },
  { label: ".", latex: ".", kind: "num" },
  { label: "π", latex: "\\pi", kind: "fn" },
  { label: "±", latex: "-(#0)", kind: "fn", title: "Schimbă semnul" },
  { label: "=", cmd: "equals", kind: "op" },
];

/* ASCIIMath spells a handful of things differently from mathjs. MathLive does
   the parsing — LaTeX in, ASCIIMath out — and this only renames the tokens it
   hands back. Every rule below exists because a test failed without it:

     -:            ASCIIMath's division sign
     log _(10)(x)  mathjs writes log10(x)
     ln(           mathjs spells the NATURAL logarithm `log`, and its base-10
                   one `log10` — so this rule has to run after the one above,
                   or every ln would quietly become a base-10 logarithm
     root(3)(27)   mathjs writes nthRoot(27, 3)
     °             mathjs takes the unit as a word */
const SUBSTITUTIONS: [RegExp, string][] = [
  [/-:/g, "/"],
  [/\blog\s*_\s*\((\d+)\)/g, "log$1"],
  [/\bln\s*\(/g, "log("],
  [/root\((\d+)\)\(([^()]*)\)/g, "nthRoot($2,$1)"],
  [/°/g, " deg"],
];

export function asciiToMath(ascii: string): string {
  return SUBSTITUTIONS.reduce((s, [from, to]) => s.replace(from, to), ascii);
}

/** True when the expression is an actual calculation rather than a single
 *  value. A lone π needs no line underneath telling you what π is. */
export function isComputation(latex: string): boolean {
  return /[+\-*/^]|\\times|\\div|\\frac|\\sqrt|\\sin|\\cos|\\tan|\\ln|\\log/.test(
    latex.trim().slice(1),
  );
}
