import { Suspense } from "react";
import { connection } from "next/server";
import { Files, HardDrive, Users, Activity, Flame } from "lucide-react";
import {
  getOverview,
  getFileTypes,
  getUploadsDaily,
  getLoginsDaily,
  getActiveUsers,
} from "@/server/admin/stats";
import { ACTIVE_USER_WINDOWS, type ActiveUserWindow } from "@/lib/active-users";
import { formatBytes } from "@/lib/format";
import {
  FileTypesChart,
  UploadsChart,
  LoginsChart,
} from "@/components/dashboard/OverviewCharts";
import { ActiveUsersWindow } from "@/components/dashboard/ActiveUsersWindow";
import { ActiveUsersLeaderboard } from "@/components/dashboard/ActiveUsersLeaderboard";
import { viewerAllowedSections } from "@/server/admin/guard";
import { ListSkeleton } from "@/components/drive/ListSkeleton";

// Resolve the ?au= window param to one of the offered windows (default 30).
function resolveWindow(raw: string | undefined): ActiveUserWindow {
  const n = Number(raw);
  return (ACTIVE_USER_WINDOWS as readonly number[]).includes(n)
    ? (n as ActiveUserWindow)
    : 30;
}

// The leaderboard exposes per-user activity and links to the user detail, so
// it's gated on the "users" section — a manager without that permission sees
// nothing here (Overview itself stays visible). Header + selector live inside
// so the whole card appears/streams as one unit.
async function ActiveUsersSection({ days }: { days: number }) {
  await connection();
  const allowed = await viewerAllowedSections();
  if (allowed !== null && !allowed.includes("users")) return null;

  const users = await getActiveUsers(days, 10);
  return (
    <section className="rounded-2xl border border-zinc-800/70 bg-zinc-900/40 p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
          <Flame className="h-4 w-4 text-indigo-400" /> Cei mai activi useri
        </h2>
        <ActiveUsersWindow selected={days} />
      </div>
      <ActiveUsersLeaderboard users={users} />
    </section>
  );
}

export const metadata = { title: "Dashboard — Overview" };

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
    <div className="rounded-2xl border border-zinc-800/70 bg-zinc-900/40 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium text-zinc-500">{label}</span>
        <span className="shrink-0 text-zinc-600">{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-zinc-50">{value}</p>
    </div>
  );
}

// The stats are uncached aggregates, so the KPIs and charts stream behind
// <Suspense> while the page heading paints instantly.
async function OverviewContent() {
  await connection();
  const [overview, fileTypes, uploads, logins] = await Promise.all([
    getOverview(),
    getFileTypes(),
    getUploadsDaily(30),
    getLoginsDaily(30),
  ]);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Kpi icon={<Files className="h-4 w-4" />} label="Fișiere" value={String(overview.fileCount)} />
        <Kpi icon={<HardDrive className="h-4 w-4" />} label="Spațiu total fișiere" value={formatBytes(overview.totalSize)} />
        <Kpi icon={<Users className="h-4 w-4" />} label="Useri" value={String(overview.userCount)} />
        <Kpi icon={<Activity className="h-4 w-4" />} label="Online" value={String(overview.onlineCount)} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-zinc-800/70 bg-zinc-900/40 p-4 sm:p-5">
          <h2 className="mb-3 text-sm font-semibold text-zinc-200">Tipuri de fișiere</h2>
          <FileTypesChart data={fileTypes} />
        </section>
        <section className="rounded-2xl border border-zinc-800/70 bg-zinc-900/40 p-4 sm:p-5">
          <h2 className="mb-3 text-sm font-semibold text-zinc-200">Uploads (30 zile)</h2>
          <UploadsChart data={uploads} />
        </section>
      </div>

      <section className="rounded-2xl border border-zinc-800/70 bg-zinc-900/40 p-4 sm:p-5">
        <h2 className="mb-3 text-sm font-semibold text-zinc-200">Accesări useri (30 zile)</h2>
        <LoginsChart data={logins} />
      </section>
    </>
  );
}

function OverviewSkeleton() {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/40" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="h-72 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/40" />
        <div className="h-72 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/40" />
      </div>
      <div className="h-72 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/40" />
    </>
  );
}

export default async function DashboardOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ au?: string }>;
}) {
  const { au } = await searchParams;
  const days = resolveWindow(au);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <header>
        <h1 className="text-xl font-semibold text-zinc-50 sm:text-2xl">Overview</h1>
        <p className="mt-1 text-sm text-zinc-400">Statistici generale ale platformei.</p>
      </header>

      <Suspense fallback={<OverviewSkeleton />}>
        <OverviewContent />
      </Suspense>

      {/* Most active users — streams in its own Suspense keyed to the window,
          so switching the period refreshes only this card. */}
      <Suspense key={days} fallback={<ListSkeleton rows={6} />}>
        <ActiveUsersSection days={days} />
      </Suspense>
    </div>
  );
}
