"use client";

import { Toaster as Sonner } from "sonner";
import { useTheme } from "@/components/theme/ThemeProvider";

// App-wide toasts (sonner): bottom-right, stacked, animated. Themed to follow
// the app's light/dark mode. Trigger from anywhere with `toast.success(...)` /
// `toast.error(...)` from "sonner".
export function AppToaster() {
  const { resolved } = useTheme();
  return (
    <Sonner
      theme={resolved}
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: "!rounded-xl !shadow-xl",
          actionButton: "!bg-indigo-600 !text-white !rounded-md",
          cancelButton: "!bg-zinc-700 !text-zinc-100 !rounded-md",
        },
      }}
    />
  );
}
