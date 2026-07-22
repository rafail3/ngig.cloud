import { ShieldX } from "lucide-react";
import { dashboardSignOut } from "@/app/dashboard/actions";

// Shown when a logged-in non-admin reaches the dashboard panel. Signing out
// here also breaks any redirect loop for a stray non-admin session.
export function Forbidden() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-zinc-950 px-4 text-center text-zinc-50">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-red-900/50 bg-red-950/40">
        <ShieldX className="h-8 w-8 text-red-400" />
      </div>
      <div>
        <h1 className="text-xl font-semibold">Acces interzis</h1>
        <p className="mt-1.5 text-sm text-zinc-400">
          Acest cont nu are drepturi de manager.
        </p>
      </div>
      <form action={dashboardSignOut}>
        <button
          type="submit"
          className="rounded-xl border border-zinc-800 px-4 py-2.5 text-sm text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-50"
        >
          Deconectează-te
        </button>
      </form>
    </div>
  );
}
