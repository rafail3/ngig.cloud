"use client";

import { useEffect } from "react";
import { toast } from "sonner";

// Surface a server action's result state (from useActionState) as a toast.
// useActionState returns a fresh state object per submission, so this fires once
// each time — errors as an error toast, `ok` as a success toast.
export function useToastState(state: { error?: string; ok?: string }): void {
  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.ok) toast.success(state.ok);
  }, [state]);
}
