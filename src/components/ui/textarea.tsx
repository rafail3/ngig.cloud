import * as React from "react"

import { cn } from "@/lib/utils"

// Same bargain as Input: a field that carries its own design opts out of the
// paint and keeps the focus ring, the disabled state and the empty-field
// selection rule.
const fieldBehavior =
  "outline-none transition-[color,box-shadow] placeholder-shown:select-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"

function Textarea({
  className,
  variant,
  ...props
}: React.ComponentProps<"textarea"> & {
  variant?: "default" | "unstyled"
}) {
  return (
    <textarea
      data-slot="textarea"
      data-variant={variant}
      className={
        variant === "unstyled"
          ? cn(fieldBehavior, className)
          : cn(
              "flex field-sizing-content min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs placeholder:text-muted-foreground md:text-sm dark:bg-input/30",
              fieldBehavior,
              "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
              className
            )
      }
      {...props}
    />
  )
}

export { Textarea }
