import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Who a notification type targets.
export type NotificationAudience = "user" | "admin";

export type NotificationTypeMeta = {
  key: string;
  label: string;
  description: string;
  audience: NotificationAudience;
  // Default message template. May contain {placeholders} filled at send time.
  defaultTitle: string;
  defaultBody: string;
  // Placeholder names available in the templates (shown in the edit UI).
  vars: string[];
};

// Catalog of every toggleable + editable notification type. Add a new event's
// entry here (with its default message) and it shows up in the dashboard,
// enabled by default. `announcement` is intentionally absent — broadcasts carry
// their own admin-written message.
export const NOTIFICATION_CATALOG: NotificationTypeMeta[] = [
  // --- User events ---------------------------------------------------------
  { key: "welcome", label: "Bun venit", description: "Mesaj de bun venit trimis utilizatorului imediat ce își creează contul.", audience: "user",
    defaultTitle: "🎉 Bine ai venit pe ngig.cloud!", defaultBody: "Contul tău e gata. Încarcă-ți primele fișiere și explorează-ți cloud-ul.", vars: [] },
  { key: "password_changed", label: "Parolă schimbată", description: "Confirmă utilizatorului că și-a schimbat singur parola din pagina de profil.", audience: "user",
    defaultTitle: "🔒 Parolă schimbată", defaultBody: "Parola contului tău a fost schimbată. Dacă nu ai fost tu, resetează-ți parola imediat.", vars: [] },
  { key: "password_reset", label: "Parolă resetată prin email", description: "Confirmă utilizatorului că parola a fost schimbată prin linkul de recuperare. Apare după ce a setat noua parolă (e deja logat).", audience: "user",
    defaultTitle: "🔐 Parolă resetată", defaultBody: "Parola ta a fost resetată prin linkul de recuperare. Dacă nu ai fost tu, contactează-ne imediat.", vars: [] },
  { key: "email_change_sent", label: "Verificare email trimisă", description: "Anunță utilizatorul că i-am trimis un link de activare pe noua adresă de email cerută.", audience: "user",
    defaultTitle: "✉️ Confirmă noua adresă de email", defaultBody: "Ți-am trimis un link de activare pe {email}. Confirmă-l pentru a finaliza schimbarea.", vars: ["email"] },
  { key: "email_activated", label: "Email activat", description: "Confirmă utilizatorului că noua adresă de email a fost activată cu succes.", audience: "user",
    defaultTitle: "✅ Email confirmat", defaultBody: "Noua ta adresă de email a fost activată cu succes.", vars: [] },
  { key: "quota_file", label: "Fișier prea mare", description: "Anunță utilizatorul că un upload a fost respins fiindcă fișierul depășește limita de mărime pe fișier.", audience: "user",
    defaultTitle: "📦 Fișier prea mare", defaultBody: "Fișierul depășește limita pe fișier ({limita}).", vars: ["limita"] },
  { key: "quota_user", label: "Spațiu insuficient (cont)", description: "Anunță utilizatorul că a rămas fără spațiu — un upload a fost respins fiindcă a atins limita totală a contului.", audience: "user",
    defaultTitle: "📦 Ai atins limita de spațiu", defaultBody: "Ai atins limita de spațiu a contului ({limita}). Șterge fișiere sau golește coșul pentru a elibera spațiu.", vars: ["limita"] },
  { key: "quota_platform", label: "Spațiu insuficient (platformă)", description: "Anunță utilizatorul că upload-ul a eșuat fiindcă spațiul total al platformei este plin.", audience: "user",
    defaultTitle: "📦 Platforma e plină", defaultBody: "Spațiul platformei este plin. Contactează administratorul.", vars: [] },
  { key: "account_blocked", label: "Cont blocat", description: "Anunță utilizatorul că un administrator i-a blocat contul (include durata și, dacă există, motivul).", audience: "user",
    defaultTitle: "🛡️ Cont blocat", defaultBody: "Contul tău a fost blocat ({durata}).{motiv}", vars: ["durata", "motiv"] },
  { key: "account_unblocked", label: "Cont deblocat", description: "Anunță utilizatorul că un administrator i-a deblocat contul.", audience: "user",
    defaultTitle: "🔓 Cont deblocat", defaultBody: "Contul tău a fost deblocat. Bine ai revenit!", vars: [] },
  { key: "forced_signout", label: "Delogat forțat", description: "Anunță utilizatorul că un administrator i-a închis toate sesiunile și trebuie să se autentifice din nou.", audience: "user",
    defaultTitle: "📤 Ai fost deconectat", defaultBody: "Un administrator a deconectat toate sesiunile contului tău. Va trebui să te autentifici din nou.", vars: [] },
  { key: "limits_changed", label: "Limite de spațiu modificate", description: "Anunță utilizatorul că un administrator i-a modificat limitele de spațiu.", audience: "user",
    defaultTitle: "💾 Limite de spațiu actualizate", defaultBody: "Limitele contului tău au fost actualizate: {detalii}.", vars: ["detalii"] },
  { key: "role_changed", label: "Rol schimbat", description: "Anunță utilizatorul când un administrator îi schimbă rolul (utilizator / administrator).", audience: "user",
    defaultTitle: "🛡️ Rol actualizat", defaultBody: "Rolul tău a fost schimbat în {rol}.", vars: ["rol"] },
  { key: "trash_purged", label: "Fișiere șterse din coș", description: "Anunță utilizatorul că fișiere din coșul lui au fost șterse definitiv după perioada de retenție, prin curățarea automată.", audience: "user",
    defaultTitle: "🗑️ Fișiere șterse din coș", defaultBody: "{numar} fișier(e) au fost șterse definitiv din coșul tău după {zile} de zile.", vars: ["numar", "zile"] },
  { key: "block_expired", label: "Blocare expirată (utilizator)", description: "Anunță utilizatorul că blocarea temporară a expirat și contul e din nou activ.", audience: "user",
    defaultTitle: "🔓 Blocare expirată", defaultBody: "Blocarea contului tău a expirat. Contul e din nou activ.", vars: [] },
  { key: "suggestion", label: "Sugestie personalizată", description: "Recomandare privată generată de motorul de activitate (ex: eliberează spațiu, organizează fișiere). Calculată local, doar din datele tale.", audience: "user",
    defaultTitle: "💡 Sugestie pentru tine", defaultBody: "{tip}", vars: ["tip"] },
  { key: "storage_alert", label: "Alertă prag de spațiu", description: "Anunță utilizatorul când stocarea lui depășește pragul pe care și l-a setat singur în profil (procent din cotă sau valoare fixă).", audience: "user",
    defaultTitle: "📢 Prag de spațiu atins", defaultBody: "Folosești {folosit} — ai depășit pragul tău de {prag}. Poți elibera spațiu sau ajusta pragul din profil.", vars: ["folosit", "prag"] },
  { key: "self_quota", label: "Plafon propriu atins", description: "Anunță utilizatorul că un upload a fost respins fiindcă ar fi depășit plafonul de stocare pe care și l-a setat singur în profil.", audience: "user",
    defaultTitle: "📦 Ți-ai atins plafonul propriu", defaultBody: "Un upload a fost respins — ai atins plafonul de stocare setat de tine ({limita}). Îl poți ajusta din profil.", vars: ["limita"] },
  { key: "ticket_created", label: "Ticket deschis (confirmare)", description: "Confirmă utilizatorului că ticketul lui de suport a fost înregistrat, imediat după ce îl deschide.", audience: "user",
    defaultTitle: "📨 Ai deschis un ticket", defaultBody: "Am înregistrat ticketul „{subiect}” ({categorie}). Îți răspundem cât putem de repede.", vars: ["subiect", "categorie"] },
  { key: "ticket_reply", label: "Răspuns la ticket", description: "Anunță utilizatorul când un administrator răspunde la unul dintre ticketele lui de suport.", audience: "user",
    defaultTitle: "💬 Răspuns la ticketul tău", defaultBody: "Ai un răspuns nou la ticketul „{subiect}”.", vars: ["subiect"] },
  { key: "ticket_closed", label: "Ticket închis", description: "Anunță utilizatorul când ticketul lui de suport a fost închis.", audience: "user",
    defaultTitle: "✅ Ticket închis", defaultBody: "Ticketul „{subiect}” a fost închis. Îl poți redeschide oricând răspunzând.", vars: ["subiect"] },
  { key: "ticket_reopened", label: "Ticket redeschis", description: "Anunță utilizatorul când ticketul lui de suport a fost redeschis.", audience: "user",
    defaultTitle: "🔄 Ticket redeschis", defaultBody: "Ticketul „{subiect}” a fost redeschis.", vars: ["subiect"] },
  // --- Admin events --------------------------------------------------------
  { key: "invite_request", label: "Cerere de invitație", description: "Anunță administratorii când cineva cere o invitație din formularul public.", audience: "admin",
    defaultTitle: "📩 Cerere nouă de invitație", defaultBody: "{nume} ({email}) a cerut o invitație.", vars: ["nume", "email"] },
  { key: "user_registered", label: "Utilizator nou", description: "Anunță administratorii de fiecare dată când se creează un cont nou pe platformă.", audience: "admin",
    defaultTitle: "🎉 Utilizator nou", defaultBody: "{utilizator} ({email}) și-a creat un cont.", vars: ["utilizator", "email"] },
  { key: "signup_blocked", label: "Înregistrare blocată (platformă plină)", description: "Anunță administratorii când o înregistrare e refuzată fiindcă platforma a atins numărul maxim de conturi.", audience: "admin",
    defaultTitle: "🚫 Înregistrare blocată", defaultBody: "Un cont nou n-a putut fi creat — platforma a atins limita de {limita} conturi.", vars: ["limita"] },
  { key: "account_deleted", label: "Cont șters", description: "Anunță administratorii când un cont dispare de pe platformă — fie că utilizatorul l-a șters singur, fie că a fost șters din dashboard.", audience: "admin",
    defaultTitle: "🗑️ Cont șters", defaultBody: "Contul {utilizator} a fost șters, împreună cu toate datele lui.", vars: ["utilizator"] },
  { key: "user_quota", label: "User la limita de spațiu", description: "Anunță administratorii când un utilizator atinge limita totală a contului său.", audience: "admin",
    defaultTitle: "📊 Un utilizator a atins limita", defaultBody: "{utilizator} a atins limita de spațiu ({limita}).", vars: ["utilizator", "limita"] },
  { key: "platform_full", label: "Platformă aproape plină", description: "Anunță administratorii când un upload e respins fiindcă spațiul total al platformei este la limită.", audience: "admin",
    defaultTitle: "⚠️ Platforma e aproape plină", defaultBody: "Un upload a fost respins — spațiul total al platformei este aproape plin.", vars: [] },
  { key: "trash_purge_report", label: "Raport curățare coș", description: "Sumar zilnic trimis administratorilor după curățarea automată a coșurilor.", audience: "admin",
    defaultTitle: "🧹 Curățare coș", defaultBody: "{total} fișiere șterse definitiv din coșurile a {utilizatori} utilizatori.", vars: ["total", "utilizatori"] },
  { key: "block_expired_admin", label: "Blocare expirată (admin)", description: "Anunță administratorii când blocarea temporară a unui utilizator expiră.", audience: "admin",
    defaultTitle: "⏰ Blocare expirată", defaultBody: "Blocarea utilizatorului {utilizator} a expirat. Contul e din nou activ.", vars: ["utilizator"] },
  { key: "ticket_opened", label: "Ticket nou de suport", description: "Anunță administratorii când un utilizator deschide un ticket nou de suport.", audience: "admin",
    defaultTitle: "📨 Ticket nou de suport", defaultBody: "{utilizator} a deschis un ticket: „{subiect}” ({categorie}).", vars: ["utilizator", "subiect", "categorie"] },
  { key: "ticket_user_reply", label: "Răspuns pe ticket (de la user)", description: "Anunță administratorii când un utilizator răspunde la un ticket de suport.", audience: "admin",
    defaultTitle: "💬 Răspuns nou pe ticket", defaultBody: "{utilizator} a răspuns la ticketul „{subiect}”.", vars: ["utilizator", "subiect"] },
  { key: "ticket_closed_user", label: "Ticket închis de utilizator", description: "Anunță administratorii când un utilizator își închide singur ticketul de suport.", audience: "admin",
    defaultTitle: "✅ Ticket închis de utilizator", defaultBody: "{utilizator} a închis ticketul „{subiect}”.", vars: ["utilizator", "subiect"] },
];

// Actions that COULD get a notification but don't have one wired yet. Empty for
// now; as new notifiable actions are added in code, list them here and they
// appear in the dashboard's "Adaugă notificare" tab.
export const ADDABLE_ACTIONS: NotificationTypeMeta[] = [];

export type NotificationTypeStatus = NotificationTypeMeta & {
  enabled: boolean;
  // Current effective template (override if set, else the default).
  title: string;
  body: string;
  // True when an admin has customized the message away from the default.
  customized: boolean;
};

type Row = { enabled: boolean; title: string | null; body: string | null };

// Fill {placeholders} from the vars map (missing/undefined → empty string).
function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

function metaOf(type: string): NotificationTypeMeta | undefined {
  return NOTIFICATION_CATALOG.find((c) => c.key === type);
}

async function settingsRow(type: string): Promise<Row | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("notification_settings")
    .select("enabled, title, body")
    .eq("type", type)
    .maybeSingle();
  return (data as Row) ?? null;
}

// Resolve a type into a ready-to-send message, or null if the type is disabled.
// Uses the admin's edited template if set, otherwise the catalog default, then
// fills in the event's dynamic values.
export async function renderNotification(
  type: string,
  vars: Record<string, string> = {},
): Promise<{ title: string; body: string } | null> {
  const meta = metaOf(type);
  const row = await settingsRow(type);
  if (row && row.enabled === false) return null;
  const title = row?.title ?? meta?.defaultTitle ?? "";
  const body = row?.body ?? meta?.defaultBody ?? "";
  return { title: interpolate(title, vars), body: interpolate(body, vars) };
}

// Runtime gate for events that don't go through renderNotification.
export async function isTypeEnabled(type: string): Promise<boolean> {
  const row = await settingsRow(type);
  return row ? row.enabled : true;
}

// Catalog merged with each type's current enabled state + effective template.
export async function listNotificationTypes(): Promise<NotificationTypeStatus[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("notification_settings")
    .select("type, enabled, title, body");
  const rows = new Map<string, Row & { type: string }>();
  for (const r of data ?? []) rows.set(r.type as string, r as Row & { type: string });
  return NOTIFICATION_CATALOG.map((c) => {
    const r = rows.get(c.key);
    const title = r?.title ?? c.defaultTitle;
    const body = r?.body ?? c.defaultBody;
    return {
      ...c,
      enabled: r?.enabled ?? true,
      title,
      body,
      // Only "customized" when the stored message actually differs from the
      // default — a leftover override equal to the default doesn't count.
      customized: title !== c.defaultTitle || body !== c.defaultBody,
    };
  });
}

async function upsertSettings(
  type: string,
  patch: Record<string, unknown>,
): Promise<void> {
  if (!metaOf(type)) throw new Error("Tip de notificare necunoscut.");
  const admin = createAdminClient();
  const { error } = await admin
    .from("notification_settings")
    .upsert(
      { type, updated_at: new Date().toISOString(), ...patch },
      { onConflict: "type" },
    );
  if (error) throw error;
}

export async function setNotificationEnabled(type: string, enabled: boolean): Promise<void> {
  await upsertSettings(type, { enabled });
}

// Save an edited message template (custom title/body override).
export async function setNotificationTemplate(
  type: string,
  title: string,
  body: string,
): Promise<void> {
  await upsertSettings(type, { title, body });
}

// Revert a type to its default message.
export async function resetNotificationTemplate(type: string): Promise<void> {
  await upsertSettings(type, { title: null, body: null });
}
