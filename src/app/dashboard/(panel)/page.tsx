import { Files, HardDrive, Users, Activity } from "lucide-react";
import {
  getOverview,
  getFileTypes,
  getUploadsDaily,
  getLoginsDaily,
} from "@/server/admin/stats";
import { formatBytes } from "@/lib/format";
import {
  FileTypesChart,
  UploadsChart,
  LoginsChart,
} from "@/components/dashboard/OverviewCharts";

export const metadata = { title: "Dashboard — Overview" };
export const dynamic = "force-dynamic";

function Kpi({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-5">
      <div className="flex items-center gap-2 text-zinc-400">
        {icon}
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold text-zinc-50">{value}</p>
    </div>
  );
}

export default async function DashboardOverviewPage() {
  const [overview, fileTypes, uploads, logins] = await Promise.all([
    getOverview(),
    getFileTypes(),
    getUploadsDaily(30),
    getLoginsDaily(30),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <header>
        <h1 className="text-xl font-semibold text-zinc-50 sm:text-2xl">Overview</h1>
        <p className="mt-1 text-sm text-zinc-400">Statistici generale ale platformei.</p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Kpi icon={<Files className="h-4 w-4" />} label="Fișiere" value={String(overview.fileCount)} />
        <Kpi icon={<HardDrive className="h-4 w-4" />} label="Spațiu total" value={formatBytes(overview.totalSize)} />
        <Kpi icon={<Users className="h-4 w-4" />} label="Useri" value={String(overview.userCount)} />
        <Kpi icon={<Activity className="h-4 w-4" />} label="Online" value={String(overview.onlineCount)} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-5">
          <h2 className="mb-3 text-sm font-semibold text-zinc-200">Tipuri de fișiere</h2>
          <FileTypesChart data={fileTypes} />
        </section>
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-5">
          <h2 className="mb-3 text-sm font-semibold text-zinc-200">Uploads (30 zile)</h2>
          <UploadsChart data={uploads} />
        </section>
      </div>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-5">
        <h2 className="mb-3 text-sm font-semibold text-zinc-200">Accesări useri (30 zile)</h2>
        <LoginsChart data={logins} />
      </section>
    </div>
  );
}
