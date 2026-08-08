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

/* The brand's own half of the spectrum: indigo through sky to cyan and back.
   The magenta end is gone — pink and purple were what made it read as a
   decorative rainbow instead of as light. What is left still shifts hue as it
   travels, which is what keeps it alive, but every stop is a colour this app
   already uses. */
const SIRI = ["#4f46e5", "#6366f1", "#818cf8", "#38bdf8", "#22d3ee", "#818cf8", "#6366f1"];

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
      <span style={RING(10)} className={cn("absolute inset-0 rounded-[inherit] opacity-55 blur-[20px]", SPIN)} />
      {/* The same bridge the inside needs: without it the crisp edge steps
          straight down into the spill and the eye reads the step as a second
          line. */}
      <span style={RING(3)} className={cn("absolute inset-0 rounded-[inherit] opacity-50 blur-[6px]", SPIN)} />
      {/* The edge. One pixel, crisp, so the panel keeps a defined outline while
          the light moves around it. Held just under full strength so the drop
          into the bridge is a slope rather than a cliff. */}
      <span style={RING(1)} className={cn("absolute inset-0 rounded-[inherit] opacity-80", SPIN)} />
    </div>
  );
}

/* One blurred ring cannot be the whole falloff. A single layer has one peak
   and one rate of decay, so next to a crisp 90%-opacity edge it starts as a
   visible step down — the seam between "line" and "glow". Real light falls off
   in a continuous ramp.

   Three rings with growing blur and shrinking opacity add up to that ramp: the
   tight one starts bright right against the edge and hands over to the next
   before it has finished decaying, and so on outward. It is the same reason a
   good box-shadow is written as several shadows rather than one. The numbers
   are chosen so each layer's falloff still overlaps the one after it — that
   overlap IS the smoothness. */
const BLEED = [
  { width: 1, blur: 4, opacity: 0.5 }, // bridges the crisp edge
  { width: 2, blur: 14, opacity: 0.36 }, // the body of the glow
  { width: 3, blur: 36, opacity: 0.24 }, // the long tail into the surface
];

/** The inside of the panel: the same light, running in from the border and
 *  dissolving. Render as the first child of the clipped box, with the content
 *  after it in a positioned wrapper so the content still paints on top. Kept
 *  dim on purpose — this passes underneath text. */
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
      style={duration(seconds)}
      className={cn("pointer-events-none absolute inset-0 rounded-[inherit]", className)}
    >
      {BLEED.map((l) => (
        <span
          key={l.blur}
          style={{ ...RING(l.width), opacity: l.opacity, filter: `blur(${l.blur}px)` }}
          className={cn("absolute inset-0 rounded-[inherit]", SPIN)}
        />
      ))}
    </span>
  );
}
