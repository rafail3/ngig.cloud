"use client";

import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";

/* Crossfades the folder contents when navigating between folders. Keyed on the
   folder id, so a navigation swaps the whole region (and replays the list
   stagger) while an in-place refresh — same id — leaves it to the lists' own
   layout animations. */
export function DriveTransition({ id, children }: { id: string; children: ReactNode }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={id}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="flex flex-col gap-4"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
