import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Who a notification type targets. "both" fires for the user AND the admins
// (e.g. a block expiring notifies the affected user and all admins).
export type NotificationAudience = "user" | "admin" | "both";

export type NotificationTypeMeta = {
  key: string;
  label: string;
  description: string;
  audience: NotificationAudience;
};

// Catalog of every toggleable event-notification type. When a new event is
// wired in code, add its entry here and it shows up in the dashboard, enabled by
// default. `announcement` is intentionally absent — broadcasts always deliver.
export const NOTIFICATION_CATALOG: NotificationTypeMeta[] = [
  // --- User events ---------------------------------------------------------
  { key: "welcome", label: "Bun venit", description: "La crearea contului (înregistrare).", audience: "user" },
  { key: "password_changed", label: "Parolă schimbată", description: "Când userul își schimbă parola din profil.", audience: "user" },
  { key: "password_reset", label: "Parolă resetată", description: "Când parola e resetată prin linkul de recuperare.", audience: "user" },
  { key: "email_change_sent", label: "Verificare email trimisă", description: "Când s-a trimis linkul de activare pentru noua adresă.", audience: "user" },
  { key: "email_activated", label: "Email activat", description: "Când noua adresă de email a fost confirmată.", audience: "user" },
  { key: "quota_file", label: "Fișier prea mare", description: "Upload respins — depășește limita pe fișier.", audience: "user" },
  { key: "quota_user", label: "Spațiu insuficient (cont)", description: "Upload respins — userul a atins limita contului.", audience: "user" },
  { key: "quota_platform", label: "Spațiu insuficient (platformă)", description: "Upload respins — spațiul platformei e plin.", audience: "user" },
  { key: "account_blocked", label: "Cont blocat", description: "Când un admin blochează contul userului.", audience: "user" },
  { key: "account_unblocked", label: "Cont deblocat", description: "Când un admin deblochează contul.", audience: "user" },
  { key: "forced_signout", label: "Delogat forțat", description: "Când un admin deconectează sesiunile userului.", audience: "user" },
  { key: "limits_changed", label: "Limite de spațiu modificate", description: "Când un admin schimbă limitele de spațiu ale userului.", audience: "user" },
  { key: "trash_purged", label: "Fișiere șterse din coș", description: "Când cronul șterge definitiv fișiere din coșul userului.", audience: "user" },
  // --- Shared --------------------------------------------------------------
  { key: "block_expired", label: "Blocare expirată", description: "Când o blocare temporară expiră (userul + adminii).", audience: "both" },
  // --- Admin events --------------------------------------------------------
  { key: "invite_request", label: "Cerere de invitație", description: "Când cineva cere o invitație din formularul public.", audience: "admin" },
  { key: "user_registered", label: "Utilizator nou", description: "Când se creează un cont nou.", audience: "admin" },
  { key: "user_quota", label: "User la limita de spațiu", description: "Când un user atinge limita contului.", audience: "admin" },
  { key: "platform_full", label: "Platformă aproape plină", description: "Când un upload e respins fiindcă platforma e la limită.", audience: "admin" },
  { key: "trash_purge_report", label: "Raport curățare coș", description: "Sumarul zilnic al curățării coșurilor (cron).", audience: "admin" },
];

export type NotificationTypeStatus = NotificationTypeMeta & { enabled: boolean };

// Runtime gate: a type is enabled unless a settings row explicitly disables it.
export async function isTypeEnabled(type: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("notification_settings")
    .select("enabled")
    .eq("type", type)
    .maybeSingle();
  return data ? (data.enabled as boolean) : true;
}

// Catalog merged with each type's current enabled state, for the dashboard.
export async function listNotificationTypes(): Promise<NotificationTypeStatus[]> {
  const admin = createAdminClient();
  const { data } = await admin.from("notification_settings").select("type, enabled");
  const overrides = new Map<string, boolean>();
  for (const r of data ?? []) overrides.set(r.type as string, r.enabled as boolean);
  return NOTIFICATION_CATALOG.map((c) => ({
    ...c,
    enabled: overrides.get(c.key) ?? true,
  }));
}

// Toggle a type on/off (admin action). Only known catalog types are accepted.
export async function setNotificationEnabled(
  type: string,
  enabled: boolean,
): Promise<void> {
  if (!NOTIFICATION_CATALOG.some((c) => c.key === type)) {
    throw new Error("Tip de notificare necunoscut.");
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from("notification_settings")
    .upsert(
      { type, enabled, updated_at: new Date().toISOString() },
      { onConflict: "type" },
    );
  if (error) throw error;
}
