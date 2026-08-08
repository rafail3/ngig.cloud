import { cn } from "@/lib/utils";

/* A light that travels around the contour of a panel — the Apple Intelligence
   / Siri edge glow, at the scale of a popover rather than a whole screen.

   Adapted from Magic UI's ShineBorder. The trick worth keeping is the mask: a
   gradient is painted across the whole box, then two masks are composited with
   `exclude` so everything except a border-width ring survives. That is what
   makes it a glowing EDGE rather than a coloured card, and it costs one
   element and no JavaScript — the movement is `background-position` on a
   300%-sized gradient.

   What is added here is depth, in three layers that all run the same animation
   at the same duration so they stay locked together:

     GlowBorder  — outside the panel: a wide blurred halo (the spill) under a
                   one-pixel ring (the edge).
     GlowBleed   — inside the panel: a ring blurred so heavily that its light
                   runs inward and dissolves into the surface.

   The inner one is the reason the panel had to be restructured. A single
   masked ring has a hard cut on both sides, which reads as a coloured border;
   and anything painted behind an opaque `bg-zinc-900` is simply invisible. The
   bleed therefore lives INSIDE the clipped box, above the background and below
   the content, where `overflow-hidden` throws away its outward half and leaves
   only the half that fades in. */

/* Indigo carries the loop — it bookends the gradient and appears twice more —
   with the Siri hues passing through as accents. Deliberately no green or
   yellow: skipping the middle of the spectrum is what keeps this reading as
   one light shifting hue rather than as a rainbow. */
const SIRI = ["#6366f1", "#818cf8", "#a855f7", "#e879f9", "#fb7185", "#38bdf8", "#6366f1"];

const RING = (width: number) =>
  ({
    backgroundImage: `radial-gradient(transparent,transparent,${SIRI.join(",")},transparent,transparent)`,
    backgroundSize: "300% 300%",
    // Paint everything, then subtract the padding box: what survives is a ring
    // exactly `width` thick, following whatever radius it inherits.
    mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
    WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
    maskComposite: "exclude",
    WebkitMaskComposite: "xor",
    padding: `${width}px`,
  }) as React.CSSProperties;

// A literal class plus a CSS variable, not `animate-[shine_${duration}s...]`:
// Tailwind's scanner reads source as text and never sees a class assembled from
// a template literal, so that utility would simply not be generated.
const SPIN = "motion-safe:animate-shine will-change-[background-position]";

function duration(seconds: number) {
  return { "--glow-duration": `${seconds}s` } as React.CSSProperties;
}

/** The outside of the panel: spill plus a defined edge. Position it from the
 *  call site — usually `-inset-px` with a radius one pixel larger than the
 *  panel's own. Must NOT sit inside an `overflow-hidden` box, or the halo is
 *  cut in half by its own parent. */
export function GlowBorder({
  className,
  seconds = 7,
}: {
  className?: string;
  seconds?: number;
}) {
  return (
    <div
      aria-hidden
      style={duration(seconds)}
      className={cn("pointer-events-none absolute rounded-[inherit]", className)}
    >
      {/* The spill. Thick and heavily blurred, so the panel looks lit from
          behind rather than outlined. */}
      <span style={RING(8)} className={cn("absolute inset-0 rounded-[inherit] opacity-70 blur-[14px]", SPIN)} />
      {/* The edge. One pixel, crisp, so the panel keeps a defined outline while
          the light moves around it. */}
      <span style={RING(1)} className={cn("absolute inset-0 rounded-[inherit] opacity-90", SPIN)} />
    </div>
  );
}

/** The inside of the panel: the same light, blurred far enough that it runs in
 *  from the border and dissolves. Render as the first child of the clipped
 *  box, with the content after it in a positioned wrapper so the content still
 *  paints on top. Kept dim on purpose — this passes underneath text. */
export function GlowBleed({
  className,
  seconds = 7,
}: {
  className?: string;
  seconds?: number;
}) {
  return (
    <span
      aria-hidden
      style={{ ...RING(3), ...duration(seconds) }}
      className={cn(
        "pointer-events-none absolute inset-0 rounded-[inherit] opacity-35 blur-[22px]",
        SPIN,
        className,
      )}
    />
  );
}
