import { Suspense } from "react";
import { connection } from "next/server";
import { Info } from "lucide-react";
import { getCostReport, resolveMonth, recentMonths } from "@/server/admin/costs";
import { MonthSelector } from "@/components/dashboard/costs/MonthSelector";
import { CostSummary } from "@/components/dashboard/costs/CostSummary";
import { FreeTierMeter } from "@/components/dashboard/costs/FreeTierMeter";
import { TopUsersChart, CompositionChart } from "@/components/dashboard/costs/CostCharts";
import { CostTable } from "@/components/dashboard/costs/CostTable";

export const metadata = { title: "Dashboard — Costuri" };

// Fetches the report for the selected window and paints the whole view. Isolated
// so the header + period picker stay live while this streams behind <Suspense>.
async function CostData({ from, to, month }: { from: string; to: string; month: string }) {
  await connection();
  const report = await getCostReport(from, to);
  const ratesLine =
    report.ratesSource === "b2" && report.ratesUpdatedAt
      ? `Tarife actualizate din pagina Backblaze B2 la ${new Intl.DateTimeFormat("ro-RO", {
          dateStyle: "medium",
          timeZone: "Europe/Bucharest",
        }).format(new Date(report.ratesUpdatedAt))} ($${report.rates.storageUsdPerTbMonth}/TB, $${report.rates.egressUsdPerGb}/GB).`
      : `Tarife implicite Backblaze B2 ($${report.rates.storageUsdPerTbMonth}/TB, $${report.rates.egressUsdPerGb}/GB) — se actualizează zilnic din pagina lor.`;

  return (
    <>
      <CostSummary platform={report.platform} />

      <FreeTierMeter
        storageBytes={report.platform.storageBytes}
        freeStorageBytes={report.rates.freeStorageBytes}
        egressBytes={report.platform.egressBytes}
        egressFreeBytes={report.platform.egressFreeBytes}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TopUsersChart users={report.users} />
        <CompositionChart platform={report.platform} />
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-zinc-200">Cost per utilizator</h2>
        <CostTable users={report.users} month={month} />
      </div>

      <p className="flex items-start gap-2 text-xs leading-relaxed text-zinc-500">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          {ratesLine} Fără adaos. Stocarea e un snapshot curent (cost lunar la
          volumul de acum); egress-ul e însumat pe luna selectată. Egress gratuit
          până la 3× stocarea, apoi ${report.rates.egressUsdPerGb}/GB; tranzacțiile
          Class A/B/C sunt gratuite.
        </span>
      </p>
    </>
  );
}

function CostSkeleton() {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="h-40 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/40" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:col-span-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/40" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="h-80 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/40" />
        <div className="h-80 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/40" />
      </div>
      <div className="h-64 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/40" />
    </>
  );
}

export default async function CostsPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const { m } = await searchParams;
  const period = resolveMonth(m);
  const months = recentMonths(12);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-50 sm:text-2xl">Costuri</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Cât costă platforma la Backblaze B2 — pe utilizator și total.
          </p>
        </div>
        <MonthSelector months={months} selected={period.key} />
      </header>

      <Suspense key={period.key} fallback={<CostSkeleton />}>
        <CostData from={period.from} to={period.to} month={period.key} />
      </Suspense>
    </div>
  );
}
