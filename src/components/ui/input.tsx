import * as React from "react"

import { cn } from "@/lib/utils"

// What a field owes the user whatever it looks like: a focus ring it can be
// found by, a disabled state that is both visible and inert, and no place in a
// text selection while it is empty — an empty field has nothing to take, but a
// drag across the page would still paint its placeholder as if it did.
const fieldBehavior =
  "outline-none transition-[color,box-shadow] placeholder-shown:select-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"

function Input({
  className,
  type,
  variant,
  ...props
}: React.ComponentProps<"input"> & {
  // Fields that carry their own design opt out of the paint and keep the
  // behaviour. Bypassed rather than overridden: the base states a height, a
  // radius, a border colour and a background per theme, and a field with its
  // own look would have to undo each of them by hand.
  variant?: "default" | "unstyled"
}) {
  return (
    <input
      type={type}
      data-slot="input"
      data-variant={variant}
      className={
        variant === "unstyled"
          ? cn(fieldBehavior, className)
          : cn(
              "h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground md:text-sm dark:bg-input/30",
              fieldBehavior,
              "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
              className
            )
      }
      {...props}
    />
  )
}

export { Input }
