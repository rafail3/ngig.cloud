import type { Transition, Variants } from "motion/react";

/* The entrance shared by the floating panels that hang off the navbar — the
   notification panel and the profile menu.

   Radix already ships a fade-and-zoom through tw-animate-css. This replaces it
   for those two because a CSS keyframe cannot overshoot: it arrives exactly at
   its end value and stops. A spring settles past it and back, which is what
   makes a panel read as unfolding rather than being switched on. The blur is
   the other half — the panel resolves out of focus as it lands, so the eye
   follows the shape before it reads the text.

   Both are used with `asChild`, so the motion element IS the Radix content
   node: no extra wrapper between the positioner and the panel. Call sites must
   neutralise the primitive's own animate-in/out classes (`animate-none`),
   otherwise the CSS keyframe and the spring fight over the same transform.

   Reduced motion is honoured globally by <MotionConfig reducedMotion="user">
   in both shells, which drops the transform and leaves the fade. */

export const morphSpring: Transition = {
  type: "spring",
  stiffness: 380,
  damping: 30,
  mass: 0.8,
};

export const morphPanel: Variants = {
  hidden: { opacity: 0, scale: 0.94, y: -6, filter: "blur(6px)" },
  shown: { opacity: 1, scale: 1, y: 0, filter: "blur(0px)", transition: morphSpring },
  // Out in about a third of the time it came in. A panel that lingers on the
  // way out reads as lag, not as grace.
  gone: {
    opacity: 0,
    scale: 0.96,
    y: -4,
    filter: "blur(4px)",
    transition: { duration: 0.13, ease: "easeIn" },
  },
};
