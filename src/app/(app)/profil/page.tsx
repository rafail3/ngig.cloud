import { Suspense } from "react";
import { Mail, CalendarClock, LogIn } from "lucide-react";
import { getMyProfile, listMySessions } from "@/server/account/profile";
import { UsernameForm, PasswordForm, EmailForm } from "@/components/account/AccountForms";
import { ProfileTabs } from "@/components/account/ProfileTabs";
import { ActivityPanel } from "@/components/account/ActivityPanel";
import { ActiveSessions } from "@/components/account/ActiveSessions";
import { RealtimeRefresh } from "@/components/realtime/RealtimeRefresh";
import { formatDateTime as fmt } from "@/lib/format-date";

export const metadata = { title: "Profilul meu" };

// Profile + sessions are per-user (uncached), so the whole body streams behind
// <Suspense> while the page container paints instantly.
async function ProfileContent() {
  const [me, sessions] = await Promise.all([getMyProfile(), listMySessions()]);

  return (
    <>
      {/* Own profile updates (e.g. email change) reflect live across tabs. */}
      <RealtimeRefresh tables={["profiles"]} />

      {/* ===== Identity header ===== */}
      <header className="flex items-center gap-4">
        <span
          aria-hidden
          className="flex h-14 w-14 shrink-0 select-none items-center justify-center rounded-full bg-indigo-500/15 text-xl font-semibold uppercase text-indigo-300 ring-1 ring-inset ring-indigo-500/25 sm:h-16 sm:w-16"
        >
          {me.username.slice(0, 1)}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="min-w-0 truncate text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl">
              {me.username}
            </h1>
            {me.role === "admin" && (
              <span className="rounded bg-indigo-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-indigo-300">
                admin
              </span>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500 sm:text-sm">
            <span className="flex min-w-0 items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{me.email}</span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5" title="Cont creat">
              <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
              Membru din {fmt(me.created_at)}
            </span>
            <span className="flex shrink-0 items-center gap-1.5" title="Ultima conectare">
              <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
              Ultima conectare {fmt(me.lastSignIn)}
            </span>
          </div>
        </div>
      </header>

      {/* ===== Tabs: Cont / Securitate / Activitate ===== */}
      <ProfileTabs
        cont={
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <UsernameForm currentUsername={me.username} />
            <EmailForm currentEmail={me.email} />
          </div>
        }
        securitate={
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <PasswordForm />
            </div>
            <ActiveSessions sessions={sessions} />
          </div>
        }
        activitate={<ActivityPanel />}
      />
    </>
  );
}

function ProfileSkeleton() {
  return (
    <>
      <div className="flex items-center gap-4">
        <div className="h-14 w-14 animate-pulse rounded-full bg-zinc-900 sm:h-16 sm:w-16" />
        <div>
          <div className="h-7 w-40 animate-pulse rounded-lg bg-zinc-900" />
          <div className="mt-2 h-4 w-64 max-w-full animate-pulse rounded bg-zinc-900/70" />
        </div>
      </div>
      <div className="flex gap-6 border-b border-zinc-900 pb-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-5 w-24 animate-pulse rounded bg-zinc-900" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-64 animate-pulse rounded-2xl border border-zinc-900 bg-zinc-900/40" />
        ))}
      </div>
    </>
  );
}

export default function ProfilePage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <Suspense fallback={<ProfileSkeleton />}>
        <ProfileContent />
      </Suspense>
    </div>
  );
}
