"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

// Full-cover overlay over the users list (intercepted route). Closing returns
// to the list without a full reload; a direct URL hit renders the full page.
export function UserDetailModal({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && router.back();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [router]);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-zinc-950/80 backdrop-blur-sm"
      style={{ animation: "overlay-in 0.2s ease-out" }}
      onClick={() => router.back()}
    >
      <div className="flex min-h-full justify-center p-4 sm:p-6">
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ animation: "panel-in 0.25s ease-out" }}
          className="relative my-auto flex w-full max-w-5xl flex-col gap-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl sm:p-7"
        >
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Închide"
            className="absolute right-4 top-4 rounded-lg border border-zinc-800 p-1.5 text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
          {children}
        </div>
      </div>
    </div>
  );
}
