import { LayoutDashboard } from "lucide-react";

export const metadata = { title: "Dashboard — Overview" };

export default function DashboardOverviewPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-50 sm:text-2xl">Overview</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Statistici generale ale platformei.
        </p>
      </div>

      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 px-6 py-16 text-center">
        <LayoutDashboard className="h-8 w-8 text-zinc-600" />
        <p className="text-sm text-zinc-500">
          Graficele și KPI-urile apar aici (Faza 4).
        </p>
      </div>
    </div>
  );
}
