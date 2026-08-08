/* The keypad, as data. Five columns, so every row below is five entries.

   `insert` is what the key appends to the expression; the rest are commands
   the window handles itself. Functions insert their own opening bracket
   because that is what you always type next anyway, and the display's
   auto-closing preview shows the rest. */

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
  // Not a mode toggle: the unit rides along with the number, so `sin(45 deg)`
  // still means 45 degrees when you read it back out of the history.
  { label: "deg", insert: " deg", kind: "fn", title: "Marchează unghiul în grade" },
  { label: "⌫", cmd: "back", kind: "op", title: "Șterge un caracter" },

  { label: "ln", insert: "log(", kind: "fn", title: "Logaritm natural" },
  { label: "log", insert: "log10(", kind: "fn", title: "Logaritm în bază 10" },
  { label: "√", insert: "sqrt(", kind: "fn" },
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
  { label: "×", insert: "*", kind: "op" },
  { label: "÷", insert: "/", kind: "op" },

  { label: "1", insert: "1", kind: "num" },
  { label: "2", insert: "2", kind: "num" },
  { label: "3", insert: "3", kind: "num" },
  { label: "+", insert: "+", kind: "op" },
  { label: "−", insert: "-", kind: "op" },

  { label: "0", insert: "0", kind: "num" },
  { label: ".", insert: ".", kind: "num" },
  { label: "π", insert: "pi", kind: "fn" },
  { label: "±", cmd: "sign", kind: "fn", title: "Schimbă semnul" },
  { label: "=", cmd: "equals", kind: "op" },
];

// Typed characters that go straight into the expression. Everything else the
// keyboard can produce is either handled as a command or ignored, so stray
// letters cannot end up in an expression that will only fail to parse.
export const TYPED = new Set("0123456789.+-*/^() ".split(""));
