import Link from "next/link";
import { ArrowLeft, CalendarDays, ArrowLeftRight, UserX } from "lucide-react";
import { getPublicProfile } from "@/server/users/service";
import { Avatar } from "@/components/shell/Avatar";
import { ProfileActions } from "@/components/users/ProfileActions";
import { formatDateShort } from "@/lib/format-date";

export const metadata = { title: "Profil utilizator" };

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // No catch: getPublicProfile already returns null for an unknown id, so a
  // thrown error here is a real failure and should surface as one rather than
  // being disguised as "this user doesn't exist".
  const profile = await getPublicProfile(id);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <Link
        href="/users"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-zinc-500 transition hover:text-zinc-300"
      >
        <ArrowLeft className="h-4 w-4" />
        Utilizatori
      </Link>

      {!profile ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 px-6 py-14 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950/50 text-zinc-500">
            <UserX className="h-7 w-7" />
          </div>
          <p className="text-sm text-zinc-300">Utilizatorul nu există.</p>
          <p className="mt-1 text-sm text-zinc-500">
            Contul a fost probabil șters între timp.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 shadow-lg shadow-black/10">
          <div className="pointer-events-none h-px bg-gradient-to-r from-transparent via-zinc-50/15 to-transparent" />

          <div className="p-5 sm:p-6">
            <div className="flex items-center gap-4">
              <Avatar username={profile.username} className="h-16 w-16 text-xl" />
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-xl font-bold tracking-tight text-zinc-50 sm:text-2xl">
                  {profile.username}
                </h1>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-zinc-500">
                  <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Membru din {formatDateShort(profile.createdAt)}
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-2.5 rounded-xl border border-zinc-800 bg-zinc-950/40 px-3.5 py-3">
              <ArrowLeftRight className="h-4 w-4 shrink-0 text-indigo-400" aria-hidden />
              <p className="text-sm text-zinc-300">
                <span className="font-semibold tabular-nums text-zinc-100">
                  {profile.sharedTransfers}
                </span>{" "}
                {profile.sharedTransfers === 1
                  ? "transfer schimbat"
                  : "transferuri schimbate"}{" "}
                cu tine
              </p>
            </div>

            <div className="mt-5">
              <ProfileActions profile={profile} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
