/* The keypad, as data. Five columns, so every row below is five entries.

   What a key inserts is what you SEE: `√`, `π`, `×`, `÷`, `−`, `°`. The
   display is a single editable line, so the symbols have to live in the text
   itself — there is no second, prettier line to put them on, and a second line
   is what made the old display read double. `toMath` below turns them back
   into the syntax mathjs parses, at the moment of evaluation and nowhere else.

   Functions insert their own opening bracket, because that is what you type
   next anyway. */

type Base = { label: string; kind?: "num" | "op" | "fn"; title?: string };

export type Key =
  | (Base & { insert: string })
  | (Base & { cmd: "clear" | "back" | "equals" | "sign" | "recip" })
  | (Base & { mem: "MC" | "MR" | "M+" | "M-" });

export const KEYS: Key[] = [
  { label: "MC", mem: "MC", kind: "op", title: "Golește memoria" },
  { label: "MR", mem: "MR", kind: "op", title: "Cheamă memoria" },
  { label: "M+", mem: "M+", kind: "op", title: "Adună în memorie" },
  { label: "M−", mem: "M-", kind: "op", title: "Scade din memorie" },
  { label: "C", cmd: "clear", kind: "op", title: "Șterge tot" },

  { label: "sin", insert: "sin(", kind: "fn" },
  { label: "cos", insert: "cos(", kind: "fn" },
  { label: "tan", insert: "tan(", kind: "fn" },
  // A degree sign, not a mode toggle: the unit rides along with the number, so
  // `sin(45°)` still means 45 degrees when you read it back out of the history.
  { label: "°", insert: "°", kind: "fn", title: "Grade (ex. sin(45°))" },
  { label: "⌫", cmd: "back", kind: "op", title: "Șterge un caracter" },

  { label: "ln", insert: "ln(", kind: "fn", title: "Logaritm natural" },
  { label: "log", insert: "log(", kind: "fn", title: "Logaritm în bază 10" },
  { label: "√", insert: "√(", kind: "fn", title: "Radical" },
  { label: "xʸ", insert: "^", kind: "fn", title: "Ridicare la putere" },
  { label: "1/x", cmd: "recip", kind: "fn", title: "Inversul valorii" },

  { label: "7", insert: "7", kind: "num" },
  { label: "8", insert: "8", kind: "num" },
  { label: "9", insert: "9", kind: "num" },
  { label: "(", insert: "(", kind: "op" },
  { label: ")", insert: ")", kind: "op" },

  { label: "4", insert: "4", kind: "num" },
  { label: "5", insert: "5", kind: "num" },
  { label: "6", insert: "6", kind: "num" },
  { label: "×", insert: "×", kind: "op" },
  { label: "÷", insert: "÷", kind: "op" },

  { label: "1", insert: "1", kind: "num" },
  { label: "2", insert: "2", kind: "num" },
  { label: "3", insert: "3", kind: "num" },
  { label: "+", insert: "+", kind: "op" },
  { label: "−", insert: "−", kind: "op" },

  { label: "0", insert: "0", kind: "num" },
  { label: ".", insert: ".", kind: "num" },
  { label: "π", insert: "π", kind: "fn" },
  { label: "±", cmd: "sign", kind: "fn", title: "Schimbă semnul" },
  { label: "=", cmd: "equals", kind: "op" },
];

/* Display syntax → mathjs syntax. Applied only when an expression is about to
   be evaluated, so what is on screen never has to look like source code.

   Order matters in exactly one place: `log(` becomes `log10(` BEFORE `ln(`
   becomes `log(`, because mathjs spells the natural logarithm `log` and the
   base-10 one `log10`. Run the other way round, every `ln` would end up as a
   base-10 logarithm. `log10(` is not matched by the `log(` rule, so the first
   substitution cannot be caught by the second. */
const SUBSTITUTIONS: [RegExp, string][] = [
  [/log\(/g, "log10("],
  [/ln\(/g, "log("],
  [/√/g, "sqrt"],
  [/π/g, "pi"],
  [/×/g, "*"],
  [/÷/g, "/"],
  // U+2212 MINUS SIGN, which is what the keypad inserts — not the hyphen a
  // keyboard produces. Both have to arrive as the same operator.
  [/−/g, "-"],
  [/°/g, " deg"],
];

export function toMath(display: string): string {
  return SUBSTITUTIONS.reduce((s, [from, to]) => s.replace(from, to), display);
}

/** True when the expression is an actual calculation rather than a single
 *  value. A lone `π` needs no line underneath telling you what π is. */
export function isComputation(display: string): boolean {
  return /[+\-−*×/÷^)]/.test(display.trim().slice(1));
}
