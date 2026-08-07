import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges class names, letting later Tailwind utilities win over earlier ones.
 *
 * The shadcn convention: every primitive takes a `className` prop and merges it
 * through here, so a caller can override any style without fighting specificity
 * or duplicating the component.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
