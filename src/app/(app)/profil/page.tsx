import { Mail, ShieldCheck, CalendarClock, LogIn } from "lucide-react";
import { getMyProfile, listMySessions } from "@/server/account/profile";
import { AccountForms } from "@/components/account/AccountForms";
import { ActiveSessions } from "@/components/account/ActiveSessions";
import { formatDateTime as fmt } from "@/lib/format-date";

export const metadata = { title: "Profilul meu" };
export const dynamic = "force-dynamic";

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3">
      <span className="mt-0.5 text-indigo-400">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
        <p className="truncate text-sm text-zinc-200">{value}</p>
      </div>
    </div>
  );
}

export default async function ProfilePage() {
  const [me, sessions] = await Promise.all([getMyProfile(), listMySessions()]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold text-zinc-50 sm:text-2xl">{me.username}</h1>
        {me.role === "admin" && (
          <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-xs uppercase text-indigo-300">admin</span>
        )}
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={<Mail className="h-4 w-4" />} label="Email" value={me.email} />
        <Stat icon={<ShieldCheck className="h-4 w-4" />} label="Rol" value={me.role} />
        <Stat icon={<CalendarClock className="h-4 w-4" />} label="Cont creat" value={fmt(me.created_at)} />
        <Stat icon={<LogIn className="h-4 w-4" />} label="Ultima logare" value={fmt(me.lastSignIn)} />
      </div>

      <AccountForms currentUsername={me.username} currentEmail={me.email} />

      <ActiveSessions sessions={sessions} />
    </div>
  );
}
