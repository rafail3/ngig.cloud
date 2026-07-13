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
  { key: "welcome", label: "Bun venit", description: "Mesaj de bun venit trimis utilizatorului imediat ce își creează contul.", audience: "user" },
  { key: "password_changed", label: "Parolă schimbată", description: "Confirmă utilizatorului că și-a schimbat singur parola din pagina de profil.", audience: "user" },
  { key: "password_reset", label: "Parolă resetată prin email", description: "Confirmă utilizatorului că parola a fost schimbată cu succes prin linkul de recuperare din email. Apare după ce a setat noua parolă (e deja logat) — semnal de securitate.", audience: "user" },
  { key: "email_change_sent", label: "Verificare email trimisă", description: "Anunță utilizatorul că i-am trimis un link de activare pe noua adresă de email cerută.", audience: "user" },
  { key: "email_activated", label: "Email activat", description: "Confirmă utilizatorului că noua adresă de email a fost activată cu succes.", audience: "user" },
  { key: "quota_file", label: "Fișier prea mare", description: "Anunță utilizatorul că un upload a fost respins fiindcă fișierul depășește limita de mărime pe fișier.", audience: "user" },
  { key: "quota_user", label: "Spațiu insuficient (cont)", description: "Anunță utilizatorul că a rămas fără spațiu — un upload a fost respins fiindcă a atins limita totală a contului.", audience: "user" },
  { key: "quota_platform", label: "Spațiu insuficient (platformă)", description: "Anunță utilizatorul că upload-ul a eșuat fiindcă spațiul total al platformei este plin.", audience: "user" },
  { key: "account_blocked", label: "Cont blocat", description: "Anunță utilizatorul că un administrator i-a blocat contul (include motivul și durata).", audience: "user" },
  { key: "account_unblocked", label: "Cont deblocat", description: "Anunță utilizatorul că un administrator i-a deblocat contul.", audience: "user" },
  { key: "forced_signout", label: "Delogat forțat", description: "Anunță utilizatorul că un administrator i-a închis toate sesiunile și trebuie să se autentifice din nou.", audience: "user" },
  { key: "limits_changed", label: "Limite de spațiu modificate", description: "Anunță utilizatorul că un administrator i-a modificat limitele de spațiu (pe fișier și/sau total).", audience: "user" },
  { key: "trash_purged", label: "Fișiere șterse din coș", description: "Anunță utilizatorul că fișiere din coșul lui au fost șterse definitiv după 30 de zile, prin curățarea automată.", audience: "user" },
  // --- Shared --------------------------------------------------------------
  { key: "block_expired", label: "Blocare expirată", description: "Anunță utilizatorul că blocarea temporară a expirat și contul e din nou activ, iar administratorii că blocarea unui utilizator a expirat.", audience: "both" },
  // --- Admin events --------------------------------------------------------
  { key: "invite_request", label: "Cerere de invitație", description: "Anunță administratorii când cineva cere o invitație din formularul public.", audience: "admin" },
  { key: "user_registered", label: "Utilizator nou", description: "Anunță administratorii de fiecare dată când se creează un cont nou pe platformă.", audience: "admin" },
  { key: "user_quota", label: "User la limita de spațiu", description: "Anunță administratorii când un utilizator atinge limita totală a contului său.", audience: "admin" },
  { key: "platform_full", label: "Platformă aproape plină", description: "Anunță administratorii când un upload e respins fiindcă spațiul total al platformei este la limită.", audience: "admin" },
  { key: "trash_purge_report", label: "Raport curățare coș", description: "Sumar zilnic trimis administratorilor după curățarea automată a coșurilor (câte fișiere, pentru câți utilizatori).", audience: "admin" },
];

// Actions that COULD get a notification but don't have one wired yet. Empty for
// now — every app action that notifies is already in the catalog above. As new
// notifiable actions are added in code, list them here and they appear in the
// dashboard's "Adaugă notificare" tab.
export const ADDABLE_ACTIONS: NotificationTypeMeta[] = [];

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
