"use client";

import { useEffect, useRef } from "react";
import type { MathfieldElement } from "mathlive";

/* MathLive's editable maths field, wrapped so the rest of the calculator never
   has to know it is a web component.

   Built imperatively rather than as JSX. `<math-field>` is a custom element,
   which means it does not exist during server rendering and cannot be
   type-checked as a React intrinsic; constructing it inside an effect sidesteps
   both, and the element is only ever touched on the client.

   Two static settings have to be made before the first field is constructed:

   - `fontsDirectory` — MathLive renders with its own fonts, and Next cannot
     serve anything out of node_modules. They are copied to public/ on install
     (see scripts/copy-mathlive-fonts.mjs). Point this at the wrong place and
     the maths renders in a fallback font, subtly wrong rather than obviously
     broken.
   - `soundsDirectory = null` — otherwise it fetches keypress sounds nobody
     asked for. */

let configured = false;

export type MathFieldHandle = MathfieldElement;

export function MathField({
  onChange,
  onEnter,
  onEscape,
  fieldRef,
}: {
  /** Fires on every edit, with the field's LaTeX. */
  onChange: (latex: string) => void;
  onEnter: () => void;
  onEscape: () => void;
  /** Filled with the element once it exists, so the keypad can drive it. */
  fieldRef: React.RefObject<MathfieldElement | null>;
}) {
  const host = useRef<HTMLDivElement>(null);
  // Handlers change every render; the element is built once, so it reads them
  // through a ref rather than being rebuilt to capture new ones.
  const handlers = useRef({ onChange, onEnter, onEscape });
  // Written in an effect, not during render: a ref mutated while rendering is
  // a lint error here and a real hazard under concurrent rendering, where a
  // render can be thrown away after it has already changed something outside.
  useEffect(() => {
    handlers.current = { onChange, onEnter, onEscape };
  });

  useEffect(() => {
    const mount = host.current;
    if (!mount) return;
    let field: MathfieldElement | null = null;
    let cancelled = false;

    void import("mathlive").then((ml) => {
      if (cancelled || !mount) return;

      if (!configured) {
        ml.MathfieldElement.fontsDirectory = "/mathlive/fonts";
        ml.MathfieldElement.soundsDirectory = null;
        configured = true;
      }

      field = new ml.MathfieldElement();
      // No on-screen keyboard: this calculator has its own keypad, and the
      // virtual one would cover the document the window floats over.
      field.mathVirtualKeyboardPolicy = "manual";
      field.smartFence = true;

      field.style.width = "100%";
      field.style.border = "none";
      field.style.outline = "none";
      field.style.background = "transparent";
      field.style.fontSize = "22px";
      field.style.color = "#f4f4f5";
      field.style.setProperty("--caret-color", "#818cf8");
      field.style.setProperty("--selection-background-color", "rgba(99,102,241,0.35)");
      field.style.setProperty("--placeholder-color", "#52525b");
      field.style.setProperty("--smart-fence-color", "#a1a1aa");

      field.addEventListener("input", () => handlers.current.onChange(field?.value ?? ""));
      field.addEventListener("keydown", (e: KeyboardEvent) => {
        if (e.key === "Enter") {
          e.preventDefault();
          handlers.current.onEnter();
        }
        if (e.key === "Escape") {
          // The preview underneath closes on Escape too, and closing the
          // calculator is what the key meant while it was open.
          e.stopPropagation();
          handlers.current.onEscape();
        }
      });

      mount.appendChild(field);
      fieldRef.current = field;
      field.focus();
    });

    return () => {
      cancelled = true;
      field?.remove();
      fieldRef.current = null;
    };
  }, [fieldRef]);

  return <div ref={host} className="min-h-9 w-full" />;
}
