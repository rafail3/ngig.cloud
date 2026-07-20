import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  HardDrive,
  ArrowDownToLine,
  Wallet,
  Download,
  Eye,
  FolderArchive,
  FilePenLine,
  type LucideIcon,
} from "lucide-react";
import { getUserCostDetail, resolveMonth } from "@/server/admin/costs";
import { formatBytes } from "@/lib/format";
import { formatUsd } from "@/lib/pricing";
import { COST_CARD } from "@/components/dashboard/costs/styles";
import { UserEgressChart } from "@/components/dashboard/costs/UserEgressChart";

export const metadata = { title: "Dashboard — Cost utilizator" };

const SOURCE: Record<string, { label: string; icon: LucideIcon }> = {
  download: { label: "Descărcare", icon: Download },
  preview: { label: "Previzualizare", icon: Eye },
  folder: { label: "Folder (zip)", icon: FolderArchive },
  office: { label: "Editare Office", icon: FilePenLine },
};

const dt = new Intl.DateTimeFormat("ro-RO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Bucharest",
});

function Kpi({
  icon,
  label,
  value,
  detail,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  accent: string;
}) {
  return (
    <div className={`${COST_CARD} p-4 sm:p-5`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-500">{label}</span>
        <span className={accent}>{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-zinc-50">{value}</p>
      <span className="mt-1.5 block text-[11px] text-zinc-500">{detail}</span>
    </div>
  );
}

async function DetailContent({ id, month }: { id: string; month: string }) {
  await connection();
  const period = resolveMonth(month);
  const d = await getUserCostDetail(id, period.from, period.to);
  if (!d) notFound();

  const maxSource = Math.max(...d.egressBySource.map((s) => s.bytes), 1);
  const initial = d.username?.[0]?.toUpperCase() ?? "?";

  return (
    <>
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-500/15 text-base font-semibold text-indigo-300">
          {initial}
        </div>
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold text-zinc-100">{d.username ?? "Utilizator"}</p>
          <p className="text-xs text-zinc-500">
            {formatBytes(d.storageBytes)} · {d.fileCount} fișiere
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <Kpi
          icon={<Wallet className="h-4 w-4" />}
          label="Total / lună"
          value={formatUsd(d.totalCost)}
          detail="stocare + egress"
          accent="text-indigo-300"
        />
        <Kpi
          icon={<HardDrive className="h-4 w-4" />}
          label="Stocare"
          value={formatUsd(d.storageCost)}
          detail={`${formatBytes(d.storageBytes)} · ${d.fileCount} fișiere`}
          accent="text-blue-300"
        />
        <Kpi
          icon={<ArrowDownToLine className="h-4 w-4" />}
          label="Egress"
          value={formatUsd(d.egressCost)}
          detail={`${formatBytes(d.egressBytes)} în perioadă`}
          accent="text-amber-300"
        />
      </div>

      <section className={`${COST_CARD} p-4 sm:p-5`}>
        <h2 className="mb-3 text-sm font-semibold text-zinc-200">Egress în timp</h2>
        <UserEgressChart data={d.egressDaily} />
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Per-source split */}
        <section className={`${COST_CARD} p-4 sm:p-5`}>
          <h2 className="mb-4 text-sm font-semibold text-zinc-200">Egress pe tip acțiune</h2>
          {d.egressBySource.length === 0 ? (
            <p className="text-sm text-zinc-500">Niciun egress în perioadă.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {d.egressBySource.map((s) => {
                const meta = SOURCE[s.source] ?? { label: s.source, icon: Download };
                const Icon = meta.icon;
                return (
                  <li key={s.source}>
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-zinc-300">
                        <Icon className="h-4 w-4 text-zinc-500" />
                        {meta.label}
                      </span>
                      <span className="tabular-nums text-zinc-400">{formatBytes(s.bytes)}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-zinc-500/20">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-400"
                        style={{ width: `${(s.bytes / maxSource) * 100}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Recent flux timeline */}
        <section className={`${COST_CARD} p-4 sm:p-5`}>
          <h2 className="mb-4 text-sm font-semibold text-zinc-200">Flux recent</h2>
          {d.recentFlow.length === 0 ? (
            <p className="text-sm text-zinc-500">Nicio activitate de egress în perioadă.</p>
          ) : (
            <ol className="relative flex flex-col gap-4 before:absolute before:left-[7px] before:top-1 before:h-[calc(100%-1rem)] before:w-px before:bg-zinc-800">
              {d.recentFlow.map((f, i) => {
                const meta = SOURCE[f.source] ?? { label: f.source, icon: Download };
                const Icon = meta.icon;
                return (
                  <li key={i} className="relative flex items-start gap-3 pl-6">
                    <span className="absolute left-0 top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="flex items-center gap-1.5 text-zinc-200">
                          <Icon className="h-3.5 w-3.5 text-zinc-500" />
                          {meta.label}
                        </span>
                        <span className="shrink-0 tabular-nums text-zinc-400">
                          {formatBytes(f.bytes)}
                        </span>
                      </div>
                      <span className="text-[11px] text-zinc-500">{dt.format(new Date(f.createdAt))}</span>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>
    </>
  );
}

function DetailSkeleton() {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/40" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/40" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="h-64 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/40" />
        <div className="h-64 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/40" />
      </div>
    </>
  );
}

export default async function UserCostPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ m?: string }>;
}) {
  const { id } = await params;
  const { m } = await searchParams;
  const period = resolveMonth(m);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-col gap-3">
        <Link
          href={`/costs?m=${period.key}`}
          className="inline-flex w-fit items-center gap-1.5 text-sm text-zinc-400 transition-colors hover:text-zinc-200"
        >
          <ArrowLeft className="h-4 w-4" /> Înapoi la costuri
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-zinc-50 sm:text-2xl">Cost utilizator</h1>
          <p className="mt-1 text-sm capitalize text-zinc-400">{period.label}</p>
        </div>
      </header>

      <Suspense key={`${id}-${period.key}`} fallback={<DetailSkeleton />}>
        <DetailContent id={id} month={period.key} />
      </Suspense>
    </div>
  );
}
