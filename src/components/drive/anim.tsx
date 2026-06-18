"use client";

import { useEffect, type ReactNode } from "react";
import { motion, type Transition, type Variants } from "motion/react";

/* Shared motion vocabulary for the whole drive surface, so every panel, card and
   menu animates with the same subtle-pro feel. Durations are short and springs
   are stiff/damped — movement is felt, not watched. Reduced-motion is honored
   globally via <MotionConfig reducedMotion="user"> in AppShell.

   Modals use the AnimatePresence-at-parent pattern: the parent wraps the
   conditional `{open && <SomeModal key="x" />}` in <AnimatePresence>, and the
   modal returns <ModalShell>. That keeps the instance (and its state) mounted
   through the exit animation, so even stateful modals fade out cleanly. */

export const panelSpring: Transition = { type: "spring", stiffness: 420, damping: 32, mass: 0.7 };
const scrimTransition: Transition = { duration: 0.18, ease: "easeOut" };

// Staggered list entrance (folder grid / file rows).
export const listContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.035, delayChildren: 0.02 } },
};
export const listItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 500, damping: 34 } },
};

// Entrance pop for portal menus (kebab). Spread onto a motion element.
export const menuMotion = {
  initial: { opacity: 0, scale: 0.94, y: -4 },
  animate: { opacity: 1, scale: 1, y: 0 },
  transition: { type: "spring", stiffness: 500, damping: 34, mass: 0.6 } as Transition,
};

// Animated modal chrome: fading scrim + spring panel. Render as the root of a
// modal that the parent mounts conditionally inside <AnimatePresence>.
export function ModalShell({
  onClose,
  children,
  className = "max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl",
  scrim = "bg-black/70",
  lockScroll = true,
}: {
  onClose: () => void;
  children: ReactNode;
  className?: string;
  scrim?: string;
  lockScroll?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    if (lockScroll) document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      if (lockScroll) document.body.style.overflow = "";
    };
  }, [onClose, lockScroll]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={scrimTransition}
    >
      <div className={`absolute inset-0 ${scrim} backdrop-blur-sm`} onClick={onClose} />
      <motion.div
        className={`relative w-full ${className}`}
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 6 }}
        transition={panelSpring}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
