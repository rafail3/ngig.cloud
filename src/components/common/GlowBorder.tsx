import { cn } from "@/lib/utils";

/* A light that travels around the contour of a panel — the Apple Intelligence
   / Siri edge glow, at the scale of a popover rather than a whole screen.

   Adapted from Magic UI's ShineBorder. The trick worth keeping is the mask: a
   gradient is painted across the whole box, then two masks are composited with
   `exclude` so everything except a border-width ring is cut away. That is what
   makes it a glowing EDGE rather than a coloured card, and it costs one
   element and no JavaScript — the movement is `background-position` on a
   300%-sized gradient.

   What is added here is the second layer. One crisp ring alone reads as a
   novelty rainbow border; the light comes from a blurred copy of the same ring
   underneath it, running the same animation at the same duration so the two
   stay locked together. The palette stays in the cool half of the spectrum —
   indigo through sky — so it belongs to an app whose accent is indigo instead
   of looking like a gamer keyboard.

   `motion-safe:` rather than a JS check: with no animation the ring is still
   there, just still. */

// Indigo → purple → pink → sky. Ordered so the warm point is brief.
const SIRI = ["#6366f1", "#a855f7", "#ec4899", "#38bdf8"];

const RING = (width: number) =>
  ({
    "--glow-w": `${width}px`,
    backgroundImage: `radial-gradient(transparent,transparent,${SIRI.join(",")},transparent,transparent)`,
    backgroundSize: "300% 300%",
    // Paint everything, then subtract the padding box: what survives is a ring
    // exactly --glow-w thick, following whatever radius it inherits.
    mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
    WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
    maskComposite: "exclude",
    WebkitMaskComposite: "xor",
    padding: `${width}px`,
  }) as React.CSSProperties;

export function GlowBorder({
  className,
  duration = 7,
}: {
  /** Position and radius come from the caller — usually `-inset-px` plus a
   *  radius one pixel larger than the panel's own. */
  className?: string;
  /** Seconds for one full pass of the light. */
  duration?: number;
}) {
  // A literal class plus a CSS variable, not `animate-[shine_${duration}s...]`:
  // Tailwind's scanner reads source as text and never sees a class assembled
  // from a template literal, so that utility would simply not be generated.
  const spin = "motion-safe:animate-shine";
  return (
    <div
      aria-hidden
      style={{ "--glow-duration": `${duration}s` } as React.CSSProperties}
      className={cn("pointer-events-none absolute rounded-[inherit]", className)}
    >
      {/* The light. Blurred and generous, so it reads as spill rather than as
          a second border. */}
      <span
        style={RING(4)}
        className={cn(
          "absolute inset-0 rounded-[inherit] opacity-80 blur-[7px] will-change-[background-position]",
          spin,
        )}
      />
      {/* The edge. One pixel, crisp, to keep the panel's outline defined while
          the light moves behind it. */}
      <span
        style={RING(1)}
        className={cn(
          "absolute inset-0 rounded-[inherit] opacity-90 will-change-[background-position]",
          spin,
        )}
      />
    </div>
  );
}
