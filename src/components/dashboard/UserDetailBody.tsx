import { AlertTriangle } from "lucide-react";
import { formatBytes } from "@/lib/format";
import { formatDateTime as fmt } from "@/lib/format-date";
import { isOnline, isBlocked } from "@/lib/user-presence";
import { UserActions } from "@/components/dashboard/UserActions";
import { RoleBadge } from "@/components/dashboard/RoleBadge";
import { Avatar } from "@/components/shell/Avatar";
import type { AdminUser } from "@/server/admin/users";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-zinc-900 py-2.5 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <dt className="text-sm text-zinc-500">{label}</dt>
      <dd className="text-sm text-zinc-200">{value}</dd>
    </div>
  );
}

// Shared detail content — rendered both as a full page and inside the
// intercepted overlay. The page/overlay wrappers add their own chrome.
export function UserDetailBody({ user, isSelf }: { user: AdminUser; isSelf: boolean }) {
  const online = isOnline(user.last_seen_at);
  const blocked = isBlocked(user.blocked_until);
  const location = [user.last_city, user.last_country].filter(Boolean).join(", ") || "—";

  return (
    <>
      <header className="flex items-center gap-4">
        <span className="relative shrink-0">
          <Avatar username={user.username ?? "?"} className="h-14 w-14 text-xl" />
          <span
            title={online ? "Online" : "Offline"}
            className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-zinc-950 ${
              online ? "bg-emerald-400" : "bg-zinc-600"
            }`}
          />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-zinc-50 sm:text-2xl">{user.username}</h1>
            <RoleBadge role={user.role} superAdmin={user.is_super_admin} />
            {blocked && (
              <span className="inline-flex items-center gap-1 rounded-full border border-red-500/40 bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-300">
                Blocat
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-sm text-zinc-400">{user.email ?? "—"}</p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-zinc-800/70 bg-zinc-900/40 p-4 sm:p-5">
          <h2 className="mb-2 text-xs font-semibold text-zinc-400">Detalii</h2>
          <dl>
            <Row
              label="Email"
              value={
                <span className="flex flex-wrap items-center justify-end gap-1.5">
                  <span className="break-all">{user.email ?? "—"}</span>
                  {!user.email_confirmed && (
                    <span
                      title="Userul nu a confirmat noul email"
                      className="inline-flex items-center gap-1 rounded-full border border-amber-800/60 bg-amber-950/40 px-2 py-0.5 text-xs font-medium text-amber-300"
                    >
                      <AlertTriangle className="h-3 w-3" /> Neconfirmat
                    </span>
                  )}
                </span>
              }
            />
            <Row
              label="Rol"
              value={
                user.role === "admin" || user.is_super_admin ? (
                  <RoleBadge role={user.role} superAdmin={user.is_super_admin} />
                ) : (
                  "Utilizator"
                )
              }
            />
            <Row label="Status" value={online ? "Online" : "Offline"} />
            <Row label="Cont creat" value={fmt(user.account_created)} />
            <Row label="Ultima conectare" value={fmt(user.last_sign_in_at)} />
            <Row label="Ultima activitate" value={fmt(user.last_seen_at)} />
            <Row label="Locație" value={location} />
            <Row label="Spațiu total" value={`${formatBytes(user.total_size)} · ${user.file_count} fișiere`} />
            <Row
              label="Ultima încărcare"
              value={
                user.last_upload_at
                  ? `${fmt(user.last_upload_at)} (${formatBytes(user.last_upload_size ?? 0)})`
                  : "—"
              }
            />
            <Row label="Ultima descărcare" value={fmt(user.last_download_at)} />
            <Row
              label="Limită / fișier"
              value={user.max_file_size != null ? formatBytes(user.max_file_size) : "Nelimitat"}
            />
            <Row
              label="Limită totală"
              value={user.max_total_size != null ? formatBytes(user.max_total_size) : "Nelimitat"}
            />
          </dl>
        </section>

        <UserActions
          user={{
            id: user.id,
            username: user.username ?? "",
            role: user.role,
            is_super_admin: user.is_super_admin,
            blocked_until: user.blocked_until,
            blocked_reason: user.blocked_reason,
            max_file_size: user.max_file_size,
            max_total_size: user.max_total_size,
          }}
          isSelf={isSelf}
        />
      </div>
    </>
  );
}
