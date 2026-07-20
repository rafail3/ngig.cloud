"use client";

import { useEffect, useState } from "react";
import { animate, useReducedMotion } from "motion/react";

// Count-up display: animates 0 → value on mount and whenever value changes,
// formatting each frame. Respects prefers-reduced-motion (jumps straight to the
// final value). Used for the cost KPI numbers.
export function AnimatedValue({
  value,
  format,
  className = "",
  duration = 0.9,
}: {
  value: number;
  format: (n: number) => string;
  className?: string;
  duration?: number;
}) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(reduced ? value : 0);

  useEffect(() => {
    // Reduced motion → no animation; the value is rendered directly below.
    if (reduced) return;
    const controls = animate(0, value, {
      duration,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(v),
    });
    return () => controls.stop();
  }, [value, reduced, duration]);

  return (
    <span className={`tabular-nums ${className}`}>{format(reduced ? value : display)}</span>
  );
}
